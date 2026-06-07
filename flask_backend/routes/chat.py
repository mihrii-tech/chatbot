# ============================================================
# CHAT ROUTE – POST /api/chat
# ============================================================

import logging
from flask import Blueprint, request, jsonify
from services.rag_service import run_rag_pipeline
from models.database import save_message, get_conversation

logger = logging.getLogger(__name__)
chat_bp = Blueprint("chat", __name__)


@chat_bp.route("", methods=["POST"])
def chat():
    """
    POST /api/chat
    Body: { "message": "...", "sessionId": "...", "history": [...] }
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
        user_message = (data.get("message") or "").strip()
        session_id = data.get("sessionId") or "anonymous"
        history = data.get("history") or []

        if not user_message:
            return jsonify({"success": False, "error": "Ingen besked modtaget"}), 400

        if len(user_message) > 2000:
            return jsonify({"success": False, "error": "Beskeden er for lang (max 2000 tegn)"}), 400

        # Byg komplet samtalehistorik
        # Brug historik fra frontend (nyeste samtale) + ev. DB historik
        if not history:
            history = get_conversation(session_id, limit=16)

        # Tilføj aktuel besked
        messages = history + [{"role": "user", "content": user_message}]

        # Gem brugers besked i DB
        save_message(session_id, "user", user_message)

        # Kør RAG pipeline
        result = run_rag_pipeline(messages)

        # Gem AI svar i DB
        save_message(session_id, "assistant", result["message"])

        return jsonify({
            "success": True,
            "message": result["message"],
            "products": result.get("products", []),
            "suggestLead": result.get("suggestLead", False),
        })

    except RuntimeError as e:
        logger.error(f"[Chat] RuntimeError: {e}")
        return jsonify({"success": False, "error": str(e)}), 503

    except Exception as e:
        logger.error(f"[Chat] Uventet fejl: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Chatbotten er midlertidigt utilgængelig. Prøv igen om et øjeblik.",
        }), 500
