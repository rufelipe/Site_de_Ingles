#!/usr/bin/env python3
"""
Cria uma base de demonstração idempotente para testar o English School.

Uso:
  DATABASE_PATH=./english-school.sqlite3 DEMO_PASSWORD='uma-senha-forte' python backend/seed_demo.py

O conteúdo pedagógico é original e apenas inspirado em temas/níveis públicos de
British Council e Cambridge English; o script não copia textos protegidos.
"""
import os
import sqlite3
import uuid
from pathlib import Path

from app import hash_password

DB_PATH = os.environ.get("DATABASE_PATH", str(Path(__file__).resolve().parent.parent / "english-school.sqlite3"))
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "").strip()
if len(DEMO_PASSWORD) < 8:
    raise SystemExit("Defina DEMO_PASSWORD com pelo menos 8 caracteres.")

db = sqlite3.connect(DB_PATH)
db.execute("PRAGMA foreign_keys = ON")

students = [
    ("demo.aluno.a1", "Ana Demo", "Iniciante"),
    ("demo.aluno.a2", "Bruno Demo", "Básico"),
    ("demo.aluno.b1", "Carla Demo", "Intermediário"),
]

for username, name, level in students:
    row = db.execute("SELECT id FROM users WHERE username=? COLLATE NOCASE", (username,)).fetchone()
    if not row:
        user_id = uuid.uuid4().hex
        db.execute(
            "INSERT INTO users(id,username,name,role,password_hash,permissions,cpf,level) VALUES(?,?,?,?,?,?,?,?)",
            (user_id, username, name, "student", hash_password(DEMO_PASSWORD), "[]", "", level),
        )
    else:
        user_id = row[0]

lesson_templates = [
    ("A1", "Introductions and personal information", "reading", 55),
    ("A1", "Everyday routines and present simple", "grammar", 68),
    ("A1", "Shopping and prices", "listening", 72),
    ("A1", "Short messages and forms", "writing", 80),
    ("A2", "Travel plans and directions", "speaking", 62),
    ("A2", "Home and neighbourhood vocabulary", "vocabulary", 76),
    ("A2", "Past events and simple stories", "reading", 71),
    ("A2", "Workplace conversations", "listening", 64),
    ("B1", "Giving opinions and reasons", "speaking", 58),
    ("B1", "Connected texts and email writing", "writing", 73),
    ("B1", "News and everyday discussions", "listening", 67),
    ("B1", "Grammar in real-world communication", "grammar", 81),
]

source_notes = {
    "A1": "Referências de nível e habilidades: https://learnenglish.britishcouncil.org/level/understand-your-level/a1-elementary e https://www.cambridgeenglish.org/learning-english/activities-for-learners/?level=basic",
    "A2": "Referências de nível e habilidades: https://learnenglish.britishcouncil.org/level/understand-your-english-level e https://www.cambridgeenglish.org/learning-english/activities-for-learners/?level=basic",
    "B1": "Referências de nível e habilidades: https://learnenglish.britishcouncil.org/level/understand-your-english-level e https://www.cambridgeenglish.org/learning-english/activities-for-learners/?level=independent",
}

for student_index, (username, _, _) in enumerate(students):
    user_id = db.execute("SELECT id FROM users WHERE username=? COLLATE NOCASE", (username,)).fetchone()[0]
    for lesson_index, (level, title, skill, score) in enumerate(lesson_templates):
        demo_title = f"[DEMO {level}] {title}"
        existing = db.execute("SELECT id FROM lessons WHERE student_id=? AND title=?", (user_id, demo_title)).fetchone()
        if existing:
            lesson_id = existing[0]
        else:
            lesson_id = uuid.uuid4().hex
            completed = 1 if (lesson_index + student_index) % 3 != 0 else 0
            db.execute(
                "INSERT INTO lessons(id,student_id,title,level,release_day,completed) VALUES(?,?,?,?,?,?)",
                (lesson_id, user_id, demo_title, level, lesson_index % 7, completed),
            )
        adjusted = max(35, min(95, score + student_index * 6 - lesson_index % 4 * 3))
        db.execute(
            "INSERT INTO progress(id,user_id,lesson_id,event,value) VALUES(?,?,?,?,?)",
            (uuid.uuid4().hex, user_id, lesson_id, f"skill_{skill}", adjusted),
        )
        db.execute(
            "INSERT OR REPLACE INTO notes(user_id,lesson_id,attachment_id,content,updated_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)",
            (user_id, lesson_id, "", source_notes[level]),
        )

db.commit()
db.close()
print("Base de demonstração criada/atualizada.")
print("Usuários:", ", ".join(username for username, _, _ in students))
