# ============================================================
# DATABASE MODEL – SQLite til leads og samtalehistorik
# ============================================================

import sqlite3
import logging
import os
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent.parent / "data" / "velohouse.db"


def get_conn():
    """Returnér database forbindelse."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Opret tabeller hvis de ikke eksisterer."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_conn()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS leads (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT,
                name        TEXT,
                email       TEXT,
                phone       TEXT,
                message     TEXT,
                email_sent  INTEGER DEFAULT 0,
                created_at  TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS conversations (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id  TEXT NOT NULL,
                role        TEXT NOT NULL,
                content     TEXT NOT NULL,
                created_at  TEXT DEFAULT (datetime('now'))
            );

            CREATE INDEX IF NOT EXISTS idx_leads_session
                ON leads(session_id);
            CREATE INDEX IF NOT EXISTS idx_conv_session
                ON conversations(session_id);
        """)
        conn.commit()
        logger.info(f"[DB] Database klar: {DB_PATH}")
    finally:
        conn.close()


# ─── Leads ────────────────────────────────────────────────────

def save_lead(lead: dict) -> int:
    """Gem et lead og returnér dets ID."""
    conn = get_conn()
    try:
        cur = conn.execute(
            """INSERT INTO leads (session_id, name, email, phone, message, email_sent)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                lead.get("session_id"),
                lead.get("name"),
                lead.get("email"),
                lead.get("phone"),
                lead.get("message"),
                1 if lead.get("email_sent") else 0,
            ),
        )
        conn.commit()
        lead_id = cur.lastrowid
        if lead_id is None:
            raise RuntimeError("Kunne ikke hente insert ID for lead")
        logger.info(f"[DB] Lead gemt: ID={lead_id}, navn={lead.get('name')}")
        return lead_id
    finally:
        conn.close()


def get_all_leads(limit: int = 100) -> list:
    """Hent alle leads (til admin)."""
    conn = get_conn()
    try:
        rows = conn.execute(
            "SELECT * FROM leads ORDER BY created_at DESC LIMIT ?", (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


# ─── Samtalehistorik ──────────────────────────────────────────

def save_message(session_id: str, role: str, content: str):
    """Gem en besked i samtalehistorik."""
    conn = get_conn()
    try:
        conn.execute(
            "INSERT INTO conversations (session_id, role, content) VALUES (?, ?, ?)",
            (session_id, role, content),
        )
        conn.commit()
    finally:
        conn.close()


def get_conversation(session_id: str, limit: int = 20) -> list:
    """Hent samtalehistorik for en session."""
    conn = get_conn()
    try:
        rows = conn.execute(
            """SELECT role, content FROM conversations
               WHERE session_id = ?
               ORDER BY created_at DESC
               LIMIT ?""",
            (session_id, limit),
        ).fetchall()
        # Returner i kronologisk rækkefølge
        return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]
    finally:
        conn.close()
