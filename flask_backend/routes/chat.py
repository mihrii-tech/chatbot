# ============================================================
# CHAT ROUTE – POST /api/chat
# ============================================================

import json
import logging
from flask import Blueprint, request, jsonify, Response
from services.rag_service import run_rag_pipeline, run_rag_pipeline_stream
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
        stream_requested = data.get("stream", False)

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

        if stream_requested:
            metadata, stream_gen = run_rag_pipeline_stream(messages)

            def event_generator():
                # 1. Send initial metadata (produkter, lead status)
                info_data = {
                    "products": metadata["products"],
                    "suggestLead": metadata["suggestLead"]
                }
                yield f"event: info\ndata: {json.dumps(info_data)}\n\n"

                # 2. Stream tokens fra Gemini
                full_response = []
                try:
                    for chunk in stream_gen:
                        if chunk.text:
                            full_response.append(chunk.text)
                            yield f"event: chunk\ndata: {json.dumps({'text': chunk.text})}\n\n"
                except Exception as e:
                    logger.error(f"[Chat Stream] Gemini stream fejl: {e}")
                    yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
                    return

                # Gem AI svar i DB efter succesfuld generering
                final_text = "".join(full_response)
                if final_text:
                    save_message(session_id, "assistant", final_text)

                yield "event: done\ndata: {}\n\n"

            resp = Response(event_generator(), mimetype="text/event-stream")
            resp.headers["Cache-Control"] = "no-cache"
            resp.headers["Connection"] = "keep-alive"
            resp.headers["X-Accel-Buffering"] = "no"
            return resp

        # Kør RAG pipeline (standard JSON fallback)
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
