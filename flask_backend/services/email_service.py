# ============================================================
# EMAIL SERVICE – sender leads via Gmail SMTP
# ============================================================

import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

logger = logging.getLogger(__name__)

SMTP_USER = os.getenv("SMTP_USER", "") or os.getenv("GMAIL_USER", "")
SMTP_PASS = os.getenv("SMTP_PASSWORD", "") or os.getenv("GMAIL_APP_PASSWORD", "")
LEAD_EMAIL = os.getenv("LEAD_EMAIL", "contact@velohouse.dk")

# Vælg SMTP host baseret på om der bruges Gmail
SMTP_HOST = os.getenv("SMTP_HOST")
if not SMTP_HOST:
    if "gmail.com" in SMTP_USER.lower():
        SMTP_HOST = "smtp.gmail.com"
    else:
        SMTP_HOST = "mail.velohouse.dk"

SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))


def send_lead_email(lead: dict) -> bool:
    """Send lead notifikation til butikken via SMTP."""
    # Tjek om credentials er tomme eller indeholder standard placeholders
    is_placeholder = (
        "din@gmail.com" in SMTP_USER.lower() or 
        "udfyld" in SMTP_USER.lower() or 
        "xxxx" in SMTP_PASS or 
        "udfyld" in SMTP_PASS.lower()
    )
    if not SMTP_USER or not SMTP_PASS or is_placeholder:
        logger.warning("[Email] SMTP credentials er ikke konfigureret eller bruger placeholders – lead gemmes kun i database")
        return False

    # Byg samtalehistorik til emailen
    history_html = ""
    history_text = ""
    if lead.get("history"):
        history_html = """
        <div style="margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
          <h3 style="color: #16213e; margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">💬 Samtaleskitse</h3>
          <div style="background: #f8fafc; padding: 16px; border-radius: 10px; font-size: 13px; line-height: 1.6; border: 1.5px solid #e2e8f0; max-height: 400px; overflow-y: auto;">
        """
        for msg in lead["history"]:
            role_name = "Kunde" if msg["role"] == "user" else "Chatbot"
            color = "#1e293b" if msg["role"] == "user" else "#00b894"
            history_html += f"<p style='margin: 8px 0;'><strong>{role_name}:</strong> <span style='color:{color};'>{msg['content']}</span></p>"
        history_html += """
          </div>
        </div>
        """

        history_text = "\n\n--- SAMTALEHISTORIK ---\n"
        for msg in lead["history"]:
            role_name = "Kunde" if msg["role"] == "user" else "Chatbot"
            history_text += f"{role_name}: {msg['content']}\n"

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🚴 Nyt lead fra Velohouse Chatbot – {lead.get('name', 'Ukendt')}"
        msg["From"] = f"Velohouse Chatbot <{SMTP_USER}>"
        msg["To"] = LEAD_EMAIL

        timestamp = datetime.now().strftime("%d/%m/%Y kl. %H:%M")

        html = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 20px; }}
    .container {{ max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }}
    .header {{ background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px; text-align: center; }}
    .header h1 {{ color: white; margin: 0; font-size: 24px; }}
    .header p {{ color: #00b894; margin: 8px 0 0; font-size: 14px; }}
    .body {{ padding: 32px; }}
    .field {{ margin-bottom: 20px; padding: 16px; background: #f8fafc; border-radius: 10px; border-left: 4px solid #00b894; }}
    .field label {{ font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; display: block; margin-bottom: 6px; }}
    .field value {{ font-size: 16px; color: #1e293b; font-weight: 500; }}
    .question-box {{ background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #bbf7d0; border-radius: 10px; padding: 20px; margin: 20px 0; }}
    .question-box h3 {{ color: #166534; margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }}
    .question-box p {{ color: #374151; margin: 0; font-style: italic; line-height: 1.6; }}
    .footer {{ padding: 24px 32px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }}
    .cta {{ display: inline-block; margin-top: 16px; padding: 12px 24px; background: linear-gradient(135deg, #00b894, #00cec9); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚴 Nyt Lead fra Chatbotten</h1>
      <p>Modtaget {timestamp}</p>
    </div>
    <div class="body">
      <div class="field">
        <label>Navn</label>
        <value>{lead.get('name', 'Ikke oplyst')}</value>
      </div>
      <div class="field">
        <label>Telefon</label>
        <value>{lead.get('phone', 'Ikke oplyst')}</value>
      </div>
      <div class="field">
        <label>Email</label>
        <value>{lead.get('email', 'Ikke oplyst')}</value>
      </div>
      <div class="question-box">
        <h3>💬 Kundens spørgsmål / besked</h3>
        <p>{lead.get('message', 'Ingen besked')}</p>
      </div>
      {history_html}
      <div class="field">
        <label>Session ID</label>
        <value style="font-size:13px; font-family:monospace;">{lead.get('session_id', '-')}</value>
      </div>
      <div style="text-align:center; margin-top: 24px;">
        <a href="mailto:{lead.get('email', '')}" class="cta">📧 Svar til kunden</a>
      </div>
    </div>
    <div class="footer">
      <p>Velohouse Chatbot • contact@velohouse.dk • velohouse.dk</p>
    </div>
  </div>
</body>
</html>
"""
        text = f"""
Nyt lead fra Velohouse Chatbot
Modtaget: {timestamp}

Navn: {lead.get('name', 'Ikke oplyst')}
Telefon: {lead.get('phone', 'Ikke oplyst')}
Email: {lead.get('email', 'Ikke oplyst')}
Besked: {lead.get('message', 'Ingen besked')}
Session: {lead.get('session_id', '-')}
{history_text}
"""

        msg.attach(MIMEText(text, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_USER, LEAD_EMAIL, msg.as_string())

        logger.info(f"[Email] Lead sendt til {LEAD_EMAIL}")
        return True

    except Exception as e:
        logger.error(f"[Email] Fejl ved afsendelse: {e}")
        return False
