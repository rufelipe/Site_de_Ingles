import hashlib
import io
import hmac
import json
import mimetypes
import os
import secrets
import psycopg
from psycopg.rows import dict_row
import time
import uuid
import zipfile
import xml.etree.ElementTree as ET
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent.parent
DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
MAX_REQUEST_SIZE = 55 * 1024 * 1024
SESSION_SECONDS = 60 * 60 * 24 * 7


def connect():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL não configurada. Adicione a connection string do Neon nas variáveis do Render.")
    return psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=15)


def initialize():
    username = os.environ.get("SCHOOL_ADMIN_USERNAME", "").strip()
    password = os.environ.get("SCHOOL_ADMIN_PASSWORD", "")
    if len(username) < 3 or len(password) < 12:
        raise RuntimeError("Configure SCHOOL_ADMIN_USERNAME e SCHOOL_ADMIN_PASSWORD (mínimo de 12 caracteres) no ambiente do serviço.")
    with connect() as db:
        schema = """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY, username TEXT NOT NULL,
                name TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','teacher','admin')),
                password_hash TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1,
                permissions TEXT NOT NULL DEFAULT '[]', cpf TEXT NOT NULL DEFAULT '', level TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                expires_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS lessons (
                id TEXT PRIMARY KEY, student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL, level TEXT NOT NULL DEFAULT '', release_day INTEGER NOT NULL DEFAULT 0,
                completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS attachments (
                id TEXT PRIMARY KEY, lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
                name TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL,
                content BYTEA NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS notes (
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
                attachment_id TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY(user_id, lesson_id, attachment_id)
            );
            CREATE TABLE IF NOT EXISTS feedback (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS profile_settings (
                user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                settings TEXT NOT NULL DEFAULT '{}', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS progress (
                id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
                event TEXT NOT NULL, value REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        """
        for statement in schema.split(";"):
            if statement.strip():
                db.execute(statement)
        db.execute("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''")
        db.execute("""CREATE TABLE IF NOT EXISTS game_stats (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            xp INTEGER NOT NULL DEFAULT 0,
            correct_answers INTEGER NOT NULL DEFAULT 0,
            streak INTEGER NOT NULL DEFAULT 0,
            last_active TEXT NOT NULL DEFAULT '',
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )""")
        db.execute("""CREATE TABLE IF NOT EXISTS game_attempts (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
            game_mode TEXT NOT NULL,
            correct INTEGER NOT NULL DEFAULT 0,
            xp_earned INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )""")
        db.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx ON users (LOWER(username))")
        existing = db.execute("SELECT id FROM users WHERE LOWER(username) = LOWER(%s)", (username,)).fetchone()
        if not existing:
            db.execute("INSERT INTO users(id,username,name,role,password_hash,permissions) VALUES(%s,%s,%s,%s,%s,%s)", (
                uuid.uuid4().hex, username, username, "admin", hash_password(password), json.dumps(["students", "lessons", "reports", "feedback", "team"])
            ))


def extract_attachment_text(name, mime_type, content):
    filename = str(name or "").lower()
    mime = str(mime_type or "").lower()
    try:
        if mime.startswith("text/") or filename.endswith((".txt", ".md", ".csv")):
            return content.decode("utf-8", errors="ignore")[:12000]
        if filename.endswith(".docx"):
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                xml_data = archive.read("word/document.xml")
            root = ET.fromstring(xml_data)
            ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
            return " ".join(node.text or "" for node in root.findall(".//w:t", ns))[:12000]
        if filename.endswith(".pdf") or mime == "application/pdf":
            try:
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(content))
                return "\n".join((page.extract_text() or "") for page in reader.pages[:40])[:12000]
            except Exception as error:
                print("PDF text extraction unavailable:", repr(error))
    except Exception as error:
        print("Attachment text extraction failed:", repr(error))
    return ""


def hash_password(password, salt=None):
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 310000)
    return salt.hex() + "$" + digest.hex()


def check_password(password, stored):
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 310000).hex()
        return hmac.compare_digest(candidate, digest_hex)
    except (ValueError, TypeError):
        return False


def user_json(row):
    return {"id": row["id"], "username": row["username"], "name": row["name"], "role": row["role"],
            "active": bool(row["active"]), "permissions": json.loads(row["permissions"]),
            "cpf": row["cpf"], "level": row["level"], "created_at": row["created_at"]}


class AppHandler(BaseHTTPRequestHandler):
    server_version = "EnglishSchoolAPI/1.0"

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))

    def send_json(self, status, value, headers=None):
        body = json.dumps(value, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for key, val in (headers or {}).items():
            self.send_header(key, val)
        self.end_headers()
        self.wfile.write(body)

    def body(self):
        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_REQUEST_SIZE:
            raise ValueError("Requisição excede o limite de 55 MB.")
        return self.rfile.read(length)

    def json_body(self):
        raw = self.body()
        return json.loads(raw.decode("utf-8")) if raw else {}

    def current_user(self, db):
        jar = cookies.SimpleCookie(self.headers.get("Cookie", ""))
        morsel = jar.get("school_session")
        if not morsel:
            return None
        token_hash = hashlib.sha256(morsel.value.encode()).hexdigest()
        row = db.execute("""SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id
                           WHERE s.token_hash=%s AND s.expires_at>%s AND u.active=1""", (token_hash, int(time.time()))).fetchone()
        return row

    def require_user(self, db):
        user = self.current_user(db)
        if not user:
            self.send_json(401, {"error": "Autenticação necessária."})
        return user

    def require_staff(self, db, user=None):
        user = user or self.current_user(db)
        if not user:
            self.send_json(401, {"error": "Autenticação necessária."})
            return None
        if user["role"] not in ("teacher", "admin"):
            self.send_json(403, {"error": "Acesso permitido somente à equipe."})
            return None
        return user

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        try:
            if path == "/api/health":
                return self.send_json(200, {"ok": True})
            if path.startswith("/api/"):
                return self.api("GET", path, parse_qs(parsed.query))
            return self.static_file(path)
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
        except Exception as error:
            print("API error:", repr(error))
            self.send_json(500, {"error": "Erro interno do servidor."})

    def do_POST(self):
        self.dispatch("POST")

    def do_PUT(self):
        self.dispatch("PUT")

    def do_PATCH(self):
        self.dispatch("PATCH")

    def do_DELETE(self):
        self.dispatch("DELETE")

    def dispatch(self, method):
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        try:
            if not path.startswith("/api/"):
                return self.send_json(404, {"error": "Rota não encontrada."})
            self.api(method, path, parse_qs(parsed.query))
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
        except Exception as error:
            print("API error:", repr(error))
            self.send_json(500, {"error": "Erro interno do servidor."})

    def api(self, method, path, query):
        with connect() as db:
            if path == "/api/auth/login" and method == "POST":
                data = self.json_body()
                username = str(data.get("username", "")).strip()
                password = str(data.get("password", ""))
                role = str(data.get("role", ""))
                row = db.execute("SELECT * FROM users WHERE username=%s", (username,)).fetchone()
                if not row or not row["active"] or not check_password(password, row["password_hash"]) or (role and role not in (row["role"], "professor" if row["role"] in ("teacher", "admin") else "aluno")):
                    return self.send_json(401, {"error": "Login ou senha incorretos."})
                token = secrets.token_urlsafe(48)
                expiry = int(time.time()) + SESSION_SECONDS
                db.execute("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(%s,%s,%s)", (hashlib.sha256(token.encode()).hexdigest(), row["id"], expiry))
                secure = "; Secure" if os.environ.get("RENDER") else ""
                return self.send_json(200, {"user": user_json(row)}, {"Set-Cookie": f"school_session={token}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SESSION_SECONDS}{secure}"})

            if path == "/api/auth/logout" and method == "POST":
                user = self.current_user(db)
                if user:
                    jar = cookies.SimpleCookie(self.headers.get("Cookie", ""))
                    token_hash = hashlib.sha256(jar["school_session"].value.encode()).hexdigest()
                    db.execute("DELETE FROM sessions WHERE token_hash=%s", (token_hash,))
                return self.send_json(200, {"ok": True}, {"Set-Cookie": "school_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"})

            if path == "/api/auth/me" and method == "GET":
                user = self.require_user(db)
                if user:
                    return self.send_json(200, {"user": user_json(user)})
                return

            user = self.require_user(db)
            if not user:
                return
            parts = [part for part in path.split("/") if part]

            if path == "/api/users" and method == "GET":
                if user["role"] not in ("teacher", "admin"):
                    return self.send_json(403, {"error": "Acesso negado."})
                if user["role"] == "teacher" and not set(json.loads(user["permissions"])).intersection(("students", "lessons", "reports")):
                    return self.send_json(403, {"error": "Acesso negado."})
                rows = db.execute("SELECT * FROM users WHERE role!='admin' ORDER BY created_at DESC").fetchall()
                return self.send_json(200, {"users": [user_json(row) for row in rows]})

            if path == "/api/users" and method == "POST":
                if user["role"] == "teacher" and "students" not in json.loads(user["permissions"]):
                    return self.send_json(403, {"error": "Sem permissão para cadastrar usuários."})
                data = self.json_body()
                username, password = str(data.get("username", "")).strip(), str(data.get("password", ""))
                name, role = str(data.get("name", "")).strip(), str(data.get("role", "student"))
                if role == "teacher" and user["role"] != "admin":
                    return self.send_json(403, {"error": "Somente o administrador pode cadastrar professores."})
                if len(username) < 3 or len(password) < 8 or not name or role not in ("student", "teacher"):
                    return self.send_json(400, {"error": "Informe nome, usuário válido, senha de ao menos 8 caracteres e perfil aluno ou professor."})
                new_id = uuid.uuid4().hex
                try:
                    db.execute("INSERT INTO users(id,username,name,role,password_hash,permissions,cpf,level) VALUES(%s,%s,%s,%s,%s,%s,%s,%s)",
                               (new_id, username, name, role, hash_password(password), json.dumps(data.get("permissions", [])), str(data.get("cpf", "")).strip(), str(data.get("level", "")).strip()))
                except psycopg.IntegrityError:
                    return self.send_json(409, {"error": "Este nome de usuário já está cadastrado."})
                return self.send_json(201, {"user": user_json(db.execute("SELECT * FROM users WHERE id=%s", (new_id,)).fetchone())})

            if len(parts) == 3 and parts[1] == "users" and method in ("PATCH", "DELETE"):
                target_id = parts[2]
                target = db.execute("SELECT * FROM users WHERE id=%s AND role!='admin'", (target_id,)).fetchone()
                if user["role"] != "admin":
                    if "students" not in json.loads(user["permissions"]) or not target or target["role"] != "student":
                        return self.send_json(403, {"error": "Acesso negado."})
                if not target:
                    return self.send_json(404, {"error": "Usuário não encontrado."})
                if method == "DELETE":
                    db.execute("DELETE FROM users WHERE id=%s", (target_id,))
                    return self.send_json(200, {"ok": True})
                data = self.json_body()
                fields, values = [], []
                for key in ("name", "username", "active", "cpf", "level"):
                    if key in data:
                        fields.append(key + "=%s")
                        values.append(int(bool(data[key])) if key == "active" else str(data[key]).strip())
                if data.get("password"):
                    if len(str(data["password"])) < 8:
                        return self.send_json(400, {"error": "A senha deve ter ao menos 8 caracteres."})
                    fields.append("password_hash=%s")
                    values.append(hash_password(str(data["password"])))
                if "permissions" in data:
                    fields.append("permissions=%s")
                    values.append(json.dumps(data["permissions"]))
                if fields:
                    try:
                        db.execute("UPDATE users SET " + ",".join(fields) + " WHERE id=%s", (*values, target_id))
                    except psycopg.IntegrityError:
                        return self.send_json(409, {"error": "Este nome de usuário já está em uso."})
                return self.send_json(200, {"user": user_json(db.execute("SELECT * FROM users WHERE id=%s", (target_id,)).fetchone())})

            if path == "/api/account" and method == "PATCH":
                data = self.json_body()
                if not check_password(str(data.get("currentPassword", "")), user["password_hash"]):
                    return self.send_json(400, {"error": "A senha atual está incorreta."})
                fields, values = [], []
                username = str(data.get("username", user["username"])).strip()
                if len(username) < 3:
                    return self.send_json(400, {"error": "O usuário deve ter ao menos 3 caracteres."})
                fields.append("username=%s")
                values.append(username)
                new_password = str(data.get("password", ""))
                if new_password:
                    if len(new_password) < 8:
                        return self.send_json(400, {"error": "A nova senha deve ter ao menos 8 caracteres."})
                    fields.append("password_hash=%s")
                    values.append(hash_password(new_password))
                try:
                    db.execute("UPDATE users SET " + ",".join(fields) + " WHERE id=%s", (*values, user["id"]))
                except psycopg.IntegrityError:
                    return self.send_json(409, {"error": "Este usuário já está em uso."})
                return self.send_json(200, {"user": user_json(db.execute("SELECT * FROM users WHERE id=%s", (user["id"],)).fetchone())})

            if path == "/api/games/content" and method == "GET":
                if user["role"] != "student":
                    return self.send_json(403, {"error": "Área exclusiva do aluno."})
                lesson_rows = db.execute("SELECT id,title,description,level,completed,created_at FROM lessons WHERE student_id=%s ORDER BY created_at ASC", (user["id"],)).fetchall()
                lessons_payload = []
                for lesson_row in lesson_rows:
                    lesson_item = dict(lesson_row)
                    lesson_item["completed"] = bool(lesson_item["completed"])
                    lesson_item["notes"] = [dict(note) for note in db.execute("SELECT content FROM notes WHERE user_id=%s AND lesson_id=%s AND content<>'' ORDER BY updated_at", (user["id"], lesson_item["id"])).fetchall()]
                    lesson_item["attachments"] = [{"id": file_row["id"], "name": file_row["name"], "type": file_row["type"], "text": extract_attachment_text(file_row["name"], file_row["type"], file_row["content"])} for file_row in db.execute("SELECT id,name,mime_type AS type,content FROM attachments WHERE lesson_id=%s ORDER BY created_at", (lesson_item["id"],)).fetchall()]
                    lessons_payload.append(lesson_item)
                stats = db.execute("SELECT xp,correct_answers,streak,last_active FROM game_stats WHERE user_id=%s", (user["id"],)).fetchone()
                return self.send_json(200, {"lessons": lessons_payload, "stats": dict(stats) if stats else {"xp": 0, "correct_answers": 0, "streak": 0, "last_active": ""}})

            if path == "/api/games/attempts" and method == "POST":
                if user["role"] != "student":
                    return self.send_json(403, {"error": "Área exclusiva do aluno."})
                data = self.json_body()
                mode = str(data.get("mode", "practice"))[:40]
                if mode not in ("vocabulary", "grammar", "sentence", "translation", "question"):
                    return self.send_json(400, {"error": "Tipo de jogo inválido."})
                correct = data.get("correct") is True
                xp_earned = (15 if mode in ("sentence", "translation", "question") else 10) if correct else 0
                lesson_id = str(data.get("lessonId", "")).strip() or None
                if lesson_id and not db.execute("SELECT id FROM lessons WHERE id=%s AND student_id=%s", (lesson_id, user["id"])).fetchone():
                    return self.send_json(403, {"error": "Lição não pertence a este aluno."})
                today = time.strftime("%Y-%m-%d")
                stats = db.execute("SELECT xp,correct_answers,streak,last_active FROM game_stats WHERE user_id=%s", (user["id"],)).fetchone()
                if stats:
                    old_streak = int(stats["streak"])
                    last_active = stats["last_active"] or ""
                    if last_active != today:
                        yesterday = time.strftime("%Y-%m-%d", time.localtime(time.time() - 86400))
                        streak = old_streak + 1 if last_active == yesterday else 1
                    else:
                        streak = old_streak
                    xp_total = int(stats["xp"]) + xp_earned
                    answers_total = int(stats["correct_answers"]) + (1 if correct else 0)
                    db.execute("UPDATE game_stats SET xp=%s,correct_answers=%s,streak=%s,last_active=%s,updated_at=CURRENT_TIMESTAMP WHERE user_id=%s", (xp_total, answers_total, streak, today, user["id"]))
                else:
                    xp_total, answers_total, streak = xp_earned, (1 if correct else 0), (1 if correct else 0)
                    db.execute("INSERT INTO game_stats(user_id,xp,correct_answers,streak,last_active) VALUES(%s,%s,%s,%s,%s)", (user["id"], xp_total, answers_total, streak, today if correct else ""))
                attempt_id = uuid.uuid4().hex
                db.execute("INSERT INTO game_attempts(id,user_id,lesson_id,game_mode,correct,xp_earned) VALUES(%s,%s,%s,%s,%s,%s)", (attempt_id, user["id"], lesson_id, mode, int(correct), xp_earned))
                return self.send_json(201, {"saved": True, "stats": {"xp": xp_total, "correct_answers": answers_total, "streak": streak}})

            if path == "/api/lessons" and method == "GET":
                if user["role"] == "student":
                    lessons = db.execute("SELECT * FROM lessons WHERE student_id=%s ORDER BY created_at DESC", (user["id"],)).fetchall()
                else:
                    lessons = db.execute("SELECT l.*,u.name AS student_name,u.username FROM lessons l JOIN users u ON u.id=l.student_id ORDER BY l.created_at DESC").fetchall()
                result = []
                for lesson in lessons:
                    item = dict(lesson)
                    item["completed"] = bool(item["completed"])
                    item["attachments"] = [dict(row) for row in db.execute("SELECT id,name,mime_type AS type,size FROM attachments WHERE lesson_id=%s ORDER BY created_at", (item["id"],))]
                    result.append(item)
                return self.send_json(200, {"lessons": result})

            if path == "/api/lessons" and method == "POST":
                staff = self.require_staff(db, user)
                if not staff:
                    return
                data = self.json_body()
                student_ids = data.get("studentIds", [data.get("studentId", "")])
                title = str(data.get("title", "")).strip()
                students = [db.execute("SELECT id FROM users WHERE id=%s AND role='student' AND active=1", (sid,)).fetchone() for sid in student_ids]
                students = [student for student in students if student]
                if not title or not students:
                    return self.send_json(400, {"error": "Informe o título e pelo menos um aluno válido."})
                created = []
                for student in students:
                    lesson_id = uuid.uuid4().hex
                    db.execute("INSERT INTO lessons(id,student_id,title,description,level,release_day) VALUES(%s,%s,%s,%s,%s,%s)", (lesson_id, student["id"], title, str(data.get("description", "")).strip()[:12000], str(data.get("level", "")), int(data.get("releaseDay", 0))))
                    created.append(lesson_id)
                return self.send_json(201, {"lessonIds": created})

            if len(parts) == 3 and parts[1] == "lessons" and method in ("PATCH", "DELETE"):
                lesson_id = parts[2]
                lesson = db.execute("SELECT * FROM lessons WHERE id=%s", (lesson_id,)).fetchone()
                if not lesson:
                    return self.send_json(404, {"error": "Lição não encontrada."})
                if user["role"] == "student" and lesson["student_id"] != user["id"]:
                    return self.send_json(403, {"error": "Acesso negado."})
                if method == "DELETE":
                    staff = self.require_staff(db, user)
                    if not staff:
                        return
                    db.execute("DELETE FROM lessons WHERE id=%s", (lesson_id,))
                    return self.send_json(200, {"ok": True})
                staff = self.require_staff(db, user)
                if not staff:
                    return
                data = self.json_body()
                if "completed" in data:
                    db.execute("UPDATE lessons SET completed=%s WHERE id=%s", (int(bool(data["completed"])), lesson_id))
                return self.send_json(200, {"ok": True})

            if len(parts) == 4 and parts[1] == "lessons" and parts[3] == "files" and method == "POST":
                staff = self.require_staff(db, user)
                if not staff:
                    return
                lesson = db.execute("SELECT id FROM lessons WHERE id=%s", (parts[2],)).fetchone()
                if not lesson:
                    return self.send_json(404, {"error": "Lição não encontrada."})
                content = self.body()
                if not content:
                    return self.send_json(400, {"error": "Selecione um arquivo."})
                params = parse_qs(urlparse(self.path).query)
                name = params.get("name", ["arquivo"])[0][:255]
                mime = self.headers.get("Content-Type", "application/octet-stream")[:120]
                file_id = uuid.uuid4().hex
                db.execute("INSERT INTO attachments(id,lesson_id,name,mime_type,size,content) VALUES(%s,%s,%s,%s,%s,%s)", (file_id, parts[2], name, mime, len(content), content))
                return self.send_json(201, {"attachment": {"id": file_id, "name": name, "type": mime, "size": len(content)}})

            if len(parts) == 4 and parts[1] == "lessons" and parts[3] == "notes" and method in ("GET", "PUT"):
                lesson_id = parts[2]
                lesson = db.execute("SELECT student_id FROM lessons WHERE id=%s", (lesson_id,)).fetchone()
                if not lesson:
                    return self.send_json(404, {"error": "Lição não encontrada."})
                if user["role"] == "student" and lesson["student_id"] != user["id"]:
                    return self.send_json(403, {"error": "Acesso negado."})
                if method == "GET":
                    file_id = query.get("fileId", [""])[0]
                    row = db.execute("SELECT content,updated_at FROM notes WHERE user_id=%s AND lesson_id=%s AND attachment_id=%s", (user["id"], lesson_id, file_id)).fetchone()
                    return self.send_json(200, {"content": row["content"] if row else "", "updatedAt": row["updated_at"] if row else None})
                data = self.json_body()
                content = str(data.get("content", ""))
                if len(content) > 500000:
                    return self.send_json(400, {"error": "As anotações excedem o limite permitido."})
                file_id = str(data.get("fileId", ""))
                if file_id and not db.execute("SELECT id FROM attachments WHERE id=%s AND lesson_id=%s", (file_id, lesson_id)).fetchone():
                    return self.send_json(400, {"error": "Arquivo não pertence a esta lição."})
                db.execute("""INSERT INTO notes(user_id,lesson_id,attachment_id,content,updated_at) VALUES(%s,%s,%s,%s,CURRENT_TIMESTAMP)
                             ON CONFLICT(user_id,lesson_id,attachment_id) DO UPDATE SET content=excluded.content,updated_at=CURRENT_TIMESTAMP""",
                           (user["id"], lesson_id, file_id, content))
                return self.send_json(200, {"saved": True})

            if len(parts) == 4 and parts[1] == "files" and parts[3] == "content" and method == "GET":
                file_id = parts[2]
                row = db.execute("SELECT a.*,l.student_id FROM attachments a JOIN lessons l ON l.id=a.lesson_id WHERE a.id=%s", (file_id,)).fetchone()
                if not row:
                    return self.send_json(404, {"error": "Arquivo não encontrado."})
                if user["role"] == "student" and row["student_id"] != user["id"]:
                    return self.send_json(403, {"error": "Acesso negado."})
                content = row["content"]
                self.send_response(200)
                self.send_header("Content-Type", row["mime_type"])
                self.send_header("Content-Length", str(len(content)))
                self.send_header("Content-Disposition", "inline; filename*=UTF-8''" + __import__("urllib.parse", fromlist=["quote"]).quote(row["name"]))
                self.send_header("X-Content-Type-Options", "nosniff")
                self.end_headers()
                self.wfile.write(content)
                return

            if path == "/api/feedback" and method == "POST":
                data = self.json_body()
                message = str(data.get("message", "")).strip()
                if not message or len(message) > 2000:
                    return self.send_json(400, {"error": "O feedback deve ter entre 1 e 2000 caracteres."})
                feedback_id = uuid.uuid4().hex
                db.execute("INSERT INTO feedback(id,user_id,message) VALUES(%s,%s,%s)", (feedback_id, user["id"], message))
                return self.send_json(201, {"id": feedback_id})

            if path == "/api/feedback" and method == "GET":
                if user["role"] != "admin":
                    return self.send_json(403, {"error": "Acesso permitido somente ao administrador."})
                rows = db.execute("SELECT f.id,u.username,u.name,f.message,f.created_at FROM feedback f JOIN users u ON u.id=f.user_id ORDER BY f.created_at DESC").fetchall()
                return self.send_json(200, {"feedback": [dict(row) for row in rows]})

            if path == "/api/settings" and method in ("GET", "PUT"):
                if method == "GET":
                    row = db.execute("SELECT settings FROM profile_settings WHERE user_id=%s", (user["id"],)).fetchone()
                    return self.send_json(200, {"settings": json.loads(row["settings"]) if row else {}})
                settings = self.json_body()
                serialized = json.dumps(settings, ensure_ascii=False)
                if len(serialized) > 5_000_000:
                    return self.send_json(400, {"error": "As configurações excedem o limite."})
                db.execute("""INSERT INTO profile_settings(user_id,settings) VALUES(%s,%s)
                             ON CONFLICT(user_id) DO UPDATE SET settings=excluded.settings,updated_at=CURRENT_TIMESTAMP""", (user["id"], serialized))
                return self.send_json(200, {"saved": True})

            if path == "/api/progress" and method == "GET":
                progress_user_id = (query.get("userId") or [user["id"]])[0]
                if user["role"] == "student" and progress_user_id != user["id"]:
                    return self.send_json(403, {"error": "Acesso negado."})
                if user["role"] in ("teacher", "admin"):
                    if not db.execute("SELECT id FROM users WHERE id=%s AND role='student'", (progress_user_id,)).fetchone():
                        return self.send_json(404, {"error": "Aluno não encontrado."})
                rows = db.execute("SELECT id,lesson_id,event,value,created_at FROM progress WHERE user_id=%s ORDER BY created_at", (progress_user_id,)).fetchall()
                return self.send_json(200, {"progress": [dict(row) for row in rows]})
            if path == "/api/progress" and method == "POST":
                data = self.json_body()
                event = str(data.get("event", "")).strip()[:80]
                if not event:
                    return self.send_json(400, {"error": "Informe o evento de progresso."})
                lesson_id = data.get("lessonId") or None
                if lesson_id and not db.execute("SELECT id FROM lessons WHERE id=%s AND student_id=%s", (lesson_id, user["id"])).fetchone() and user["role"] == "student":
                    return self.send_json(403, {"error": "Acesso negado."})
                progress_id = uuid.uuid4().hex
                db.execute("INSERT INTO progress(id,user_id,lesson_id,event,value) VALUES(%s,%s,%s,%s,%s)", (progress_id, user["id"], lesson_id, event, float(data.get("value", 0))))
                return self.send_json(201, {"id": progress_id})

            return self.send_json(404, {"error": "Rota não encontrada."})

    def static_file(self, url_path):
        relative = "index.html" if url_path == "/" else url_path.lstrip("/")
        target = (ROOT / relative).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file():
            return self.send_json(404, {"error": "Arquivo não encontrado."})
        content = target.read_bytes()
        content_type = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", content_type + ("; charset=utf-8" if content_type.startswith(("text/", "application/javascript")) else ""))
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)


if __name__ == "__main__":
    initialize()
    port = int(os.environ.get("PORT", "10000"))
    print(f"English School API listening on 0.0.0.0:{port}")
    ThreadingHTTPServer(("0.0.0.0", port), AppHandler).serve_forever()
