# ============================================================
# LEADS ROUTE – POST /api/leads
# ============================================================

import re
import logging
from flask import Blueprint, request, jsonify
from models.database import save_lead, get_all_leads, get_conversation
from services.email_service import send_lead_email

logger = logging.getLogger(__name__)
leads_bp = Blueprint("leads", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
PHONE_RE = re.compile(r"^[\d\s\+\-\(\)]{8,20}$")


@leads_bp.route("", methods=["POST"])
def create_lead():
    """
    POST /api/leads
    Body: { "name", "email", "phone", "message", "sessionId" }
    """
    try:
        data = request.get_json(force=True, silent=True) or {}

        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip()
        phone = (data.get("phone") or "").strip()
        message = (data.get("message") or "").strip()
        session_id = (data.get("sessionId") or "anonymous").strip()

        # Validering
        errors = []
        if not name or len(name) < 2:
            errors.append("Navn er påkrævet (min. 2 tegn)")
        if not email or not EMAIL_RE.match(email):
            errors.append("Ugyldig email-adresse")
        if phone and not PHONE_RE.match(phone):
            errors.append("Ugyldigt telefonnummer")
        if not message or len(message) < 5:
            errors.append("Besked er påkrævet (min. 5 tegn)")

        if errors:
            return jsonify({"success": False, "errors": errors}), 400

        # Hent chat-historik for denne session
        history = get_conversation(session_id, limit=50)

        # Gem og send
        lead = {
            "session_id": session_id,
            "name": name,
            "email": email,
            "phone": phone,
            "message": message[:1000],
            "email_sent": False,
            "history": history,
        }

        # Send email (async ville være bedre i produktion)
        email_sent = send_lead_email(lead)
        lead["email_sent"] = email_sent

        lead_id = save_lead(lead)

        return jsonify({
            "success": True,
            "leadId": lead_id,
            "message": "Tak! Vi kontakter dig hurtigst muligt. 🚴",
        })

    except Exception as e:
        logger.error(f"[Leads] Fejl: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Kunne ikke gemme din henvendelse. Kontakt os direkte på contact@velohouse.dk"}), 500


@leads_bp.route("", methods=["GET"])
def list_leads():
    """GET /api/leads – Hent alle leads (kun til admin/debug)."""
    # I produktion: tilføj authentication!
    leads = get_all_leads(limit=200)
    return jsonify({"success": True, "count": len(leads), "leads": leads})
