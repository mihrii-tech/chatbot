# ============================================================
# VELOHOUSE CHATBOT – Python Flask Backend
# ============================================================
# Start: python app.py   eller   flask run
# ============================================================

import os
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

from routes.chat import chat_bp
from routes.products import products_bp
from routes.leads import leads_bp
from models.database import init_db

load_dotenv()

# ─── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

# ─── App ──────────────────────────────────────────────────────
app = Flask(__name__)

# ─── CORS ─────────────────────────────────────────────────────
allowed_origins_raw = os.getenv("CORS_ORIGINS", "")
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",") if o.strip()]

# Tilføj localhost i development
if os.getenv("FLASK_ENV") != "production":
    allowed_origins += [
        "http://localhost:3000",
        "http://localhost:5000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://127.0.0.1:5000",
        "null",  # file:// åbne filer
    ]

CORS(
    app,
    origins=allowed_origins if allowed_origins else "*",
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=False,
)

# ─── Rate Limiting ────────────────────────────────────────────
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "60 per hour"],
    storage_uri="memory://",
)

# ─── Registrér Blueprints ─────────────────────────────────────
app.register_blueprint(chat_bp, url_prefix="/api/chat")
app.register_blueprint(products_bp, url_prefix="/api/products")
app.register_blueprint(leads_bp, url_prefix="/api/leads")

# ─── Health Check ─────────────────────────────────────────────
@app.route("/api/health")
def health():
    mode = "mock" if os.getenv("USE_MOCK_PRODUCTS", "true").lower() == "true" else "shopify"
    return jsonify({
        "status": "ok",
        "service": "Velohouse Chatbot API (Python Flask)",
        "version": "2.0.0",
        "mode": mode,
        "environment": os.getenv("FLASK_ENV", "development"),
    })

@app.route("/")
def root():
    return jsonify({
        "name": "Velohouse Chatbot API",
        "version": "2.0.0",
        "stack": "Python Flask",
        "endpoints": {
            "chat": "POST /api/chat",
            "products": "GET /api/products",
            "leads": "POST /api/leads",
            "health": "GET /api/health",
        },
    })

# ─── Fejlhåndtering ───────────────────────────────────────────
@app.errorhandler(404)
def not_found(e):
    return jsonify({"success": False, "error": "Endpoint ikke fundet"}), 404

@app.errorhandler(429)
def rate_limited(e):
    return jsonify({"success": False, "error": "For mange forespørgsler. Vent et øjeblik."}), 429

@app.errorhandler(500)
def server_error(e):
    logger.error(f"Serverfejl: {e}")
    return jsonify({"success": False, "error": "Intern serverfejl. Kontakt contact@velohouse.dk"}), 500

# ─── Start ────────────────────────────────────────────────────
if __name__ == "__main__":
    # Init database
    init_db()

    port = int(os.getenv("PORT", 5001))
    debug = os.getenv("FLASK_ENV") != "production"

    print("\n╔══════════════════════════════════════════╗")
    print("║   🚴  Velohouse Chatbot (Flask)           ║")
    print("╠══════════════════════════════════════════╣")
    print(f"║  URL:  http://localhost:{port}              ║")
    mode_str = "MOCK produkter (test)" if os.getenv("USE_MOCK_PRODUCTS","true").lower()=="true" else "Shopify live data"
    print(f"║  Mode: {mode_str:<33}║")
    print(f"║  Env:  {os.getenv('FLASK_ENV','development'):<33}║")
    print("╚══════════════════════════════════════════╝\n")

    app.run(host="0.0.0.0", port=port, debug=debug)
