# ============================================================
# SHOPIFY STOREFRONT API SERVICE
# ============================================================
# Henter produktdata via GraphQL. Alle API-kald sker fra
# backend – ingen nøgler eksponeres i frontend.

import os
import json
import time
import logging
import requests
from pathlib import Path

logger = logging.getLogger(__name__)

SHOPIFY_DOMAIN = os.getenv("SHOPIFY_STORE_DOMAIN", "")
STOREFRONT_TOKEN = os.getenv("SHOPIFY_STOREFRONT_TOKEN", "")
USE_MOCK = os.getenv("USE_MOCK_PRODUCTS", "true").lower() == "true"
API_VERSION = "2024-10"

SHOPIFY_URL = f"https://{SHOPIFY_DOMAIN}/api/{API_VERSION}/graphql.json"

# ─── Simpel in-memory cache ───────────────────────────────────
_cache: dict = {}
CACHE_TTL = 900  # 15 minutter


def _cache_get(key: str):
    entry = _cache.get(key)
    if entry and (time.time() - entry["ts"]) < CACHE_TTL:
        return entry["data"]
    return None


def _cache_set(key: str, data):
    _cache[key] = {"data": data, "ts": time.time()}


# ─── GraphQL ──────────────────────────────────────────────────

PRODUCT_FIELDS = """
  fragment ProductDetails on Product {
    id title handle description productType vendor tags availableForSale
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    compareAtPriceRange {
      minVariantPrice { amount currencyCode }
    }
    images(first: 1) { edges { node { url altText } } }
    variants(first: 10) {
      edges {
        node {
          id title availableForSale
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          selectedOptions { name value }
        }
      }
    }
    collections(first: 5) { edges { node { handle title } } }
  }
"""

SEARCH_QUERY = PRODUCT_FIELDS + """
  query searchProducts($query: String!, $first: Int!) {
    search(query: $query, types: [PRODUCT], first: $first) {
      edges { node { ...on Product { ...ProductDetails } } }
    }
  }
"""

ALL_PRODUCTS_QUERY = PRODUCT_FIELDS + """
  query getAllProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: BEST_SELLING) {
      pageInfo { hasNextPage endCursor }
      edges { node { ...ProductDetails } }
    }
  }
"""


# ─── Normalisering ────────────────────────────────────────────

def _normalize(p: dict) -> dict:
    variants = []
    for e in p.get("variants", {}).get("edges", []):
        n = e["node"]
        opts = {o["name"].lower(): o["value"] for o in n.get("selectedOptions", [])}
        variants.append({
            "id": n["id"],
            "title": n["title"],
            "availableForSale": n["availableForSale"],
            "price": float(n["price"]["amount"]),
            "compareAtPrice": float(n["compareAtPrice"]["amount"]) if n.get("compareAtPrice") else None,
            "size": opts.get("størrelse") or opts.get("size"),
            "color": opts.get("farve") or opts.get("color"),
        })

    images = [
        {"url": e["node"]["url"], "altText": e["node"].get("altText")}
        for e in p.get("images", {}).get("edges", [])
    ]
    collections = [e["node"]["handle"] for e in p.get("collections", {}).get("edges", [])]

    price_min = float(p["priceRange"]["minVariantPrice"]["amount"])
    price_max = float(p["priceRange"]["maxVariantPrice"]["amount"])
    compare_min_raw = p.get("compareAtPriceRange", {}).get("minVariantPrice")
    compare_min = float(compare_min_raw["amount"]) if compare_min_raw else None

    return {
        "id": p["id"],
        "title": p["title"],
        "handle": p["handle"],
        "description": p.get("description", ""),
        "productType": p.get("productType", ""),
        "vendor": p.get("vendor", ""),
        "tags": p.get("tags", []),
        "availableForSale": p.get("availableForSale", False),
        "priceMin": price_min,
        "priceMax": price_max,
        "compareAtPriceMin": compare_min,
        "currency": p["priceRange"]["minVariantPrice"].get("currencyCode", "DKK"),
        "images": images,
        "variants": variants,
        "collections": collections,
        "url": f"https://{SHOPIFY_DOMAIN}/products/{p['handle']}",
    }


# ─── Shopify API kald ─────────────────────────────────────────

def _shopify_query(query: str, variables: dict = {}) -> dict:
    if not SHOPIFY_DOMAIN or not STOREFRONT_TOKEN:
        raise ValueError("Shopify credentials ikke konfigureret i .env")

    headers = {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
    }
    resp = requests.post(
        SHOPIFY_URL,
        json={"query": query, "variables": variables},
        headers=headers,
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    if "errors" in data:
        msgs = ", ".join(e["message"] for e in data["errors"])
        raise RuntimeError(f"Shopify GraphQL fejl: {msgs}")

    return data["data"]


# ─── Mock Produkter ───────────────────────────────────────────

def _load_mock() -> list:
    mock_path = Path(__file__).parent.parent / "data" / "mock_products.json"
    if mock_path.exists():
        with open(mock_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return _default_mock_products()


def _search_mock(query: str, filters: dict, limit: int) -> list:
    products = _load_mock()
    words = [w for w in query.lower().split() if len(w) > 2]

    scored = []
    for p in products:
        text = " ".join([
            p.get("title", ""),
            p.get("description", ""),
            p.get("productType", ""),
            p.get("vendor", ""),
            " ".join(p.get("tags", [])),
            " ".join(p.get("collections", [])),
        ]).lower()
        score = sum(1 for w in words if w in text)
        if score > 0:
            scored.append((score, p))

    scored.sort(key=lambda x: -x[0])
    results = [p for _, p in scored]

    # Filtrér
    if filters.get("maxPrice"):
        results = [p for p in results if p["priceMin"] <= filters["maxPrice"]]
    if filters.get("availableOnly", True):
        results = [p for p in results if p["availableForSale"]]
    if filters.get("productType"):
        pt = filters["productType"].lower()
        results = [
            p for p in results
            if pt in (p.get("productType") or "").lower()
            or any(pt in t.lower() for t in p.get("tags", []))
        ]

    return results[:limit]


# ─── Offentlige funktioner ────────────────────────────────────

def search_products(query: str, filters: dict = {}, limit: int = 6) -> list:
    """Søg produkter – bruger mock eller Shopify baseret på .env"""
    if USE_MOCK:
        return _search_mock(query, filters, limit)

    cache_key = f"search_{query}_{json.dumps(filters, sort_keys=True)}_{limit}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    try:
        data = _shopify_query(SEARCH_QUERY, {"query": query, "first": limit})
        products = [_normalize(e["node"]) for e in data["search"]["edges"]]

        if filters.get("maxPrice"):
            products = [p for p in products if p["priceMin"] <= filters["maxPrice"]]
        if filters.get("availableOnly"):
            products = [p for p in products if p["availableForSale"]]
        if filters.get("productType"):
            pt = filters["productType"].lower()
            products = [
                p for p in products
                if pt in (p.get("productType") or "").lower()
                or any(pt in t.lower() for t in p.get("tags", []))
            ]

        _cache_set(cache_key, products)
        return products
    except Exception as e:
        logger.error(f"[Shopify] Søgning fejlede: {e}")
        return _search_mock(query, filters, limit)


def get_all_products(limit: int = 100) -> list:
    """Hent alle produkter (til cache/knowledge base)"""
    if USE_MOCK:
        return _load_mock()

    cache_key = "all_products"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    try:
        all_products = []
        cursor = None
        has_next = True

        while has_next and len(all_products) < limit:
            batch = min(50, limit - len(all_products))
            data = _shopify_query(ALL_PRODUCTS_QUERY, {"first": batch, "after": cursor})
            edges = data["products"]["edges"]
            all_products += [_normalize(e["node"]) for e in edges]
            has_next = data["products"]["pageInfo"]["hasNextPage"]
            cursor = data["products"]["pageInfo"]["endCursor"]

        _cache_set(cache_key, all_products)
        return all_products
    except Exception as e:
        logger.error(f"[Shopify] Hentning fejlede: {e}")
        return _load_mock()


def invalidate_cache():
    _cache.clear()
    logger.info("[Shopify] Cache tømt")


# ─── Default mock data ────────────────────────────────────────

def _default_mock_products() -> list:
    return [
        {
            "id": "gid://shopify/Product/1",
            "title": "Cube Kathmandu Hybrid Pro 625 – Elcykel",
            "handle": "cube-kathmandu-hybrid-pro-625",
            "description": "Kraftfuld elcykel med 625Wh batteri og Bosch Performance Line motor. Perfekt til pendling og længere ture. Rækkevidde op til 140 km. Hydrauliske skivebremser, 12-trins Shimano gear.",
            "productType": "Elcykel",
            "vendor": "Cube",
            "tags": ["elcykel", "pendling", "bosch", "hydraulisk", "trekking"],
            "availableForSale": True,
            "priceMin": 29999.0,
            "priceMax": 29999.0,
            "compareAtPriceMin": 34999.0,
            "currency": "DKK",
            "images": [{"url": "https://placehold.co/400x300/1a1a2e/00b894?text=Cube+Kathmandu", "altText": "Cube Kathmandu Hybrid Pro"}],
            "variants": [
                {"id": "v1", "title": "M", "availableForSale": True, "price": 29999.0, "compareAtPrice": 34999.0, "size": "M", "color": None},
                {"id": "v2", "title": "L", "availableForSale": True, "price": 29999.0, "compareAtPrice": 34999.0, "size": "L", "color": None},
                {"id": "v3", "title": "XL", "availableForSale": False, "price": 29999.0, "compareAtPrice": 34999.0, "size": "XL", "color": None},
            ],
            "collections": ["elcykler", "tilbud"],
            "url": "https://velohouse.myshopify.com/products/cube-kathmandu-hybrid-pro-625",
        },
        {
            "id": "gid://shopify/Product/2",
            "title": "Riese & Müller Multicharger GT Touring – Ladcykel",
            "handle": "riese-muller-multicharger-gt",
            "description": "Premium ladcykel med dobbelt Bosch-batteri (1000Wh). Op til 4 børn eller 200 kg last. Integreret lygter, bæltetræk og Enviolo gear. Familiens perfekte transportmiddel.",
            "productType": "Ladcykel",
            "vendor": "Riese & Müller",
            "tags": ["ladcykel", "familie", "børn", "cargo", "bosch", "premium"],
            "availableForSale": True,
            "priceMin": 64999.0,
            "priceMax": 64999.0,
            "compareAtPriceMin": None,
            "currency": "DKK",
            "images": [{"url": "https://placehold.co/400x300/1a1a2e/00b894?text=R%26M+Multicharger", "altText": "Riese & Müller Multicharger"}],
            "variants": [
                {"id": "v4", "title": "46 cm", "availableForSale": True, "price": 64999.0, "compareAtPrice": None, "size": "46cm", "color": "Teal"},
                {"id": "v5", "title": "51 cm", "availableForSale": True, "price": 64999.0, "compareAtPrice": None, "size": "51cm", "color": "Teal"},
            ],
            "collections": ["ladcykler", "familie"],
            "url": "https://velohouse.myshopify.com/products/riese-muller-multicharger-gt",
        },
        {
            "id": "gid://shopify/Product/3",
            "title": "Trek FX Sport 6 – Hybridcykel",
            "handle": "trek-fx-sport-6",
            "description": "Let og hurtig hybridcykel i carbon. Shimano 105 Di2 elektronisk gear. Hydrauliske skivebremser. Vægt kun 9,2 kg. Ideel til bykørsel og weekendture.",
            "productType": "Hybridcykel",
            "vendor": "Trek",
            "tags": ["hybridcykel", "carbon", "sport", "bykørsel", "shimano", "let"],
            "availableForSale": True,
            "priceMin": 17999.0,
            "priceMax": 17999.0,
            "compareAtPriceMin": None,
            "currency": "DKK",
            "images": [{"url": "https://placehold.co/400x300/1a1a2e/00b894?text=Trek+FX+Sport+6", "altText": "Trek FX Sport 6"}],
            "variants": [
                {"id": "v6", "title": "S", "availableForSale": True, "price": 17999.0, "compareAtPrice": None, "size": "S", "color": "Sort"},
                {"id": "v7", "title": "M", "availableForSale": True, "price": 17999.0, "compareAtPrice": None, "size": "M", "color": "Sort"},
                {"id": "v8", "title": "L", "availableForSale": False, "price": 17999.0, "compareAtPrice": None, "size": "L", "color": "Sort"},
            ],
            "collections": ["hybridcykler", "sport"],
            "url": "https://velohouse.myshopify.com/products/trek-fx-sport-6",
        },
        {
            "id": "gid://shopify/Product/4",
            "title": "Riese & Müller Superdelite – Speed Pedelec 45 km/h",
            "handle": "riese-muller-superdelite",
            "description": "Verdens bedste speed pedelec. Op til 45 km/h med Bosch Speed motor og 1000Wh batteri. Kræver kørekort, forsikring og nummerplade i Danmark. Fuld suspension.",
            "productType": "Speed Pedelec",
            "vendor": "Riese & Müller",
            "tags": ["speed-pedelec", "45kmh", "hurtig", "bosch", "premium", "fuld-suspension"],
            "availableForSale": True,
            "priceMin": 79999.0,
            "priceMax": 79999.0,
            "compareAtPriceMin": None,
            "currency": "DKK",
            "images": [{"url": "https://placehold.co/400x300/1a1a2e/00b894?text=R%26M+Superdelite", "altText": "Riese & Müller Superdelite"}],
            "variants": [
                {"id": "v9", "title": "49 cm", "availableForSale": True, "price": 79999.0, "compareAtPrice": None, "size": "49cm", "color": None},
                {"id": "v10", "title": "54 cm", "availableForSale": True, "price": 79999.0, "compareAtPrice": None, "size": "54cm", "color": None},
            ],
            "collections": ["speed-pedelecs"],
            "url": "https://velohouse.myshopify.com/products/riese-muller-superdelite",
        },
        {
            "id": "gid://shopify/Product/5",
            "title": "Specialized Turbo Como SL 4.0 – Let Elcykel",
            "handle": "specialized-turbo-como-sl-4",
            "description": "Ultralet elcykel kun 14 kg med Specialized SL 1.1 motor (320Wh). Ser ud som en normal cykel. Perfekt til daglig pendling. Op til 80 km rækkevidde.",
            "productType": "Elcykel",
            "vendor": "Specialized",
            "tags": ["elcykel", "let", "pendling", "diskret", "lightweight"],
            "availableForSale": True,
            "priceMin": 24999.0,
            "priceMax": 24999.0,
            "compareAtPriceMin": None,
            "currency": "DKK",
            "images": [{"url": "https://placehold.co/400x300/1a1a2e/00b894?text=Specialized+Como+SL", "altText": "Specialized Turbo Como SL"}],
            "variants": [
                {"id": "v11", "title": "S/M", "availableForSale": True, "price": 24999.0, "compareAtPrice": None, "size": "S/M", "color": "Blå"},
                {"id": "v12", "title": "M/L", "availableForSale": True, "price": 24999.0, "compareAtPrice": None, "size": "M/L", "color": "Blå"},
                {"id": "v13", "title": "L/XL", "availableForSale": True, "price": 24999.0, "compareAtPrice": None, "size": "L/XL", "color": "Sort"},
            ],
            "collections": ["elcykler"],
            "url": "https://velohouse.myshopify.com/products/specialized-turbo-como-sl-4",
        },
        {
            "id": "gid://shopify/Product/6",
            "title": "Giro Radix MIPS – Cykelhjelm",
            "handle": "giro-radix-mips",
            "description": "Alsidig hjelm til gravel og MTB. MIPS rotationsbeskyttelse, 20 ventilationsåbninger. Passer til speed pedelec (CE-godkendt). Justerbar pasform.",
            "productType": "Hjelm",
            "vendor": "Giro",
            "tags": ["hjelm", "mips", "sikkerhed", "speed-pedelec", "gravel"],
            "availableForSale": True,
            "priceMin": 1299.0,
            "priceMax": 1299.0,
            "compareAtPriceMin": 1599.0,
            "currency": "DKK",
            "images": [{"url": "https://placehold.co/400x300/1a1a2e/00b894?text=Giro+Radix+MIPS", "altText": "Giro Radix MIPS"}],
            "variants": [
                {"id": "v14", "title": "S (51-55cm)", "availableForSale": True, "price": 1299.0, "compareAtPrice": 1599.0, "size": "S", "color": "Mat Sort"},
                {"id": "v15", "title": "M (55-59cm)", "availableForSale": True, "price": 1299.0, "compareAtPrice": 1599.0, "size": "M", "color": "Mat Sort"},
                {"id": "v16", "title": "L (59-63cm)", "availableForSale": True, "price": 1299.0, "compareAtPrice": 1599.0, "size": "L", "color": "Mat Sort"},
            ],
            "collections": ["tilbehor", "tilbud"],
            "url": "https://velohouse.myshopify.com/products/giro-radix-mips",
        },
    ]
