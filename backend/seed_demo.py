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
    ("demo.aluno.01", "Ana Demo", "Iniciante"),
    ("demo.aluno.02", "Bruno Demo", "Básico"),
    ("demo.aluno.03", "Carla Demo", "Intermediário"),
    ("demo.aluno.04", "Diego Demo", "Básico"),
    ("demo.aluno.05", "Elisa Demo", "Intermediário"),
    ("demo.aluno.06", "Felipe Demo", "Avançado"),
    ("demo.aluno.07", "Gabriela Demo", "Iniciante"),
    ("demo.aluno.08", "Henrique Demo", "Básico"),
    ("demo.aluno.09", "Isabela Demo", "Intermediário"),
    ("demo.aluno.10", "João Demo", "Avançado"),
]

lesson_templates = [
    ("A1", "Introductions and personal information", "reading", 55),
    ("A1", "Everyday routines and present simple", "grammar", 68),
    ("A1", "Shopping and prices", "listening", 72),
    ("A1", "Short messages and forms", "writing", 80),
    ("A1", "Daily activities vocabulary", "vocabulary", 64),
    ("A1", "Talking about family", "speaking", 70),
    ("A1", "Days, dates and schedules", "listening", 73),
    ("A1", "Basic questions and answers", "grammar", 66),
    ("A1", "Describing people and places", "reading", 78),
    ("A2", "Travel plans and directions", "speaking", 62),
    ("A2", "Home and neighbourhood vocabulary", "vocabulary", 76),
    ("A2", "Past events and simple stories", "reading", 71),
    ("A2", "Workplace conversations", "listening", 64),
    ("A2", "Appointments and arrangements", "speaking", 74),
    ("A2", "Writing a short personal email", "writing", 69),
    ("A2", "Comparatives and everyday choices", "grammar", 77),
    ("A2", "Food, restaurants and requests", "listening", 72),
    ("A2", "Shopping problems and solutions", "speaking", 61),
    ("A2", "Describing experiences", "reading", 75),
    ("A2", "Useful phrasal verbs", "vocabulary", 68),
    ("B1", "Giving opinions and reasons", "speaking", 58),
    ("B1", "Connected texts and email writing", "writing", 73),
    ("B1", "News and everyday discussions", "listening", 67),
    ("B1", "Grammar in real-world communication", "grammar", 81),
    ("B1", "Work and career vocabulary", "vocabulary", 79),
    ("B1", "Presenting ideas clearly", "speaking", 65),
    ("B1", "Reading for main ideas and detail", "reading", 74),
    ("B1", "Writing structured paragraphs", "writing", 70),
    ("B1", "Listening for key information", "listening", 63),
    ("B1", "Review and mixed skills challenge", "grammar", 82),
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
