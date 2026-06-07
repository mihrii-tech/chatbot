# ============================================================
# PRODUCTS ROUTE – GET /api/products
# ============================================================

import logging
from flask import Blueprint, request, jsonify
from services.shopify_service import get_all_products, search_products, invalidate_cache

logger = logging.getLogger(__name__)
products_bp = Blueprint("products", __name__)


@products_bp.route("", methods=["GET"])
def get_products():
    """
    GET /api/products
    Query params: ?q=søgetekst&type=elcykel&maxPrice=30000&limit=10
    """
    try:
        query = request.args.get("q", "").strip()
        product_type = request.args.get("type", "").strip()
        max_price_raw = request.args.get("maxPrice", "")
        limit = min(int(request.args.get("limit", 20)), 50)

        max_price = None
        if max_price_raw:
            try:
                max_price = float(max_price_raw)
            except ValueError:
                pass

        filters = {
            "productType": product_type or None,
            "maxPrice": max_price,
            "availableOnly": request.args.get("available", "true").lower() == "true",
        }

        if query:
            products = search_products(query, filters, limit=limit)
        else:
            products = get_all_products(limit=limit)

        return jsonify({
            "success": True,
            "count": len(products),
            "products": products,
        })

    except Exception as e:
        logger.error(f"[Products] Fejl: {e}")
        return jsonify({"success": False, "error": "Kunne ikke hente produkter"}), 500


@products_bp.route("/cache/clear", methods=["POST"])
def clear_cache():
    """POST /api/products/cache/clear – Tøm produkt-cache."""
    invalidate_cache()
    return jsonify({"success": True, "message": "Cache tømt"})
