#!/bin/bash
# ============================================================
# START VELOHOUSE FLASK CHATBOT
# ============================================================
cd "$(dirname "$0")"

# Aktivér virtuelt miljø hvis det eksisterer
if [ -d "/Users/mihri/chatbot_venv" ]; then
  source /Users/mihri/chatbot_venv/bin/activate
elif [ -d "venv" ]; then
  source venv/bin/activate
fi

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   🚴  Velohouse Chatbot (Flask v2.0)      ║"
echo "╠══════════════════════════════════════════╣"
echo "║  Backend: http://localhost:5000           ║"
echo "║  Test:    flask_widget/test.html          ║"
echo "╚══════════════════════════════════════════╝"
echo ""

python app.py
