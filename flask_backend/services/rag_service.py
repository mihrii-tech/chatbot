# ============================================================
# RAG PIPELINE – Retrieval-Augmented Generation
# ============================================================
# Flow:
# 1. Udtræk intent fra brugerens besked
# 2. Søg relevante produkter i Shopify
# 3. Find relevant firmainformation
# 4. Byg kontekst-streng til Gemini
# 5. Generer svar

import logging
from services.gemini_service import extract_intent, generate_response, generate_response_stream
from services.shopify_service import search_products

logger = logging.getLogger(__name__)

# ─── Firmainformation ─────────────────────────────────────────

FIRM_INFO = {
    "name": "Velohouse",
    "website": "velohouse.dk",
    "email": "contact@velohouse.dk",
    "opening_hours": "Mandag–Fredag: 10–18, Lørdag: 10–15, Søndag: Lukket. Ring inden besøg – vi anbefaler tidsbestilling til service.",
    "delivery": "Gratis levering ved køb over 500 kr. Leveringstid 2–5 hverdage i Danmark. Cykler leveres samlet. Ekspreslevering tilgængeligt mod gebyr.",
    "returns": "30 dages returret. Produktet skal returneres i original stand og emballage. Kontakt os på contact@velohouse.dk for returlabel. Refundering inden 14 dage.",
    "warranty": "2 års garanti på alle produkter iht. købeloven. Elcykelbatterier: 2 år / 500 opladninger. Reklamation sendes til contact@velohouse.dk.",
    "service": "Vi tilbyder komplet service og reparation: eftersyn, bremsejustering, gearjustering, punktering, kæde/kassette, lakering og elcykelservice. Booking via velohouse.dk eller telefon.",
    "test_ride": "Testkørsel tilbydes på udvalgte modeller. Book via velohouse.dk eller contact@velohouse.dk. Medbring billed-ID.",
    "financing": "Finansiering tilgængeligt via Santander. Op til 36 mdr. renter. Spørg i butikken.",
    "speed_pedelec": "Speed pedelecs (45 km/h) kræver i Danmark: AM-kørekort, registrering, nummerplade, forsikring og godkendt hjelm (min. NTA 8776). Vi hjælper med registrering.",
    "size_guide": "Størrelsesguide: Under 160 cm → XS/S (44-49 cm ramme). 160-170 cm → S/M (49-52 cm). 170-180 cm → M (52-56 cm). 180-190 cm → L (56-58 cm). Over 190 cm → XL (58+ cm).",
}


def _search_firm_info(message: str) -> str:
    """Find relevant firmainformation baseret på nøgleord i beskeden."""
    msg = message.lower()
    sections = []

    if any(w in msg for w in ["åbning", "åbent", "hvornår", "lukket", "tid"]):
        sections.append(f"ÅBNINGSTIDER: {FIRM_INFO['opening_hours']}")

    if any(w in msg for w in ["kontakt", "telefon", "email", "adresse", "butik", "find"]):
        sections.append(f"KONTAKT: Email: {FIRM_INFO['email']} – Website: {FIRM_INFO['website']}")

    if any(w in msg for w in ["lever", "fragt", "forsendelse", "shipping", "porto"]):
        sections.append(f"LEVERING: {FIRM_INFO['delivery']}")

    if any(w in msg for w in ["retur", "bytte", "fortryd", "refunder", "tilbage"]):
        sections.append(f"RETURREGLER: {FIRM_INFO['returns']}")

    if any(w in msg for w in ["garanti", "reklamation", "defekt", "fejl", "ødelagt"]):
        sections.append(f"GARANTI: {FIRM_INFO['warranty']}")

    if any(w in msg for w in ["service", "reparation", "mekaniker", "eftersyn", "punkter", "vedligehold"]):
        sections.append(f"SERVICE: {FIRM_INFO['service']}")

    if any(w in msg for w in ["testkørs", "prøvekørs", "prøve cykel", "test ride"]):
        sections.append(f"TESTKØRSEL: {FIRM_INFO['test_ride']}")

    if any(w in msg for w in ["finansier", "lån", "afbetal", "kredit", "rate", "afdrag"]):
        sections.append(f"FINANSIERING: {FIRM_INFO['financing']}")

    if any(w in msg for w in ["speed pedelec", "45 km", "45km", "speed-pedelec", "nummerplade"]):
        sections.append(f"SPEED PEDELEC REGLER: {FIRM_INFO['speed_pedelec']}")

    if any(w in msg for w in ["størrelse", "størrelses", "højde", "ramme størrelse", "cm høj"]):
        sections.append(f"STØRRELSESGUIDE: {FIRM_INFO['size_guide']}")

    if any(w in msg for w in ["tilbud", "rabat", "sale", "nedsat", "billig"]):
        sections.append("TILBUD: Tjek velohouse.dk for aktuelle tilbud og kampagner.")

    # Altid inkludér basis info
    sections.append(f"VELOHOUSE: {FIRM_INFO['name']} – {FIRM_INFO['website']} – {FIRM_INFO['email']}")

    return "\n\n".join(sections)


def _build_search_query(intent: dict, original: str) -> str:
    """Byg søgestreng fra intent."""
    parts = []
    if intent.get("bikeType"):
        parts.append(intent["bikeType"])
    if intent.get("purpose"):
        parts.append(intent["purpose"])
    if intent.get("brand"):
        parts.append(intent["brand"])
    if intent.get("color"):
        parts.append(intent["color"])
    for kw in (intent.get("searchKeywords") or [])[:3]:
        parts.append(kw)
    return " ".join(dict.fromkeys(parts)) if parts else original[:100]


def _build_context(products: list, firm_text: str, intent: dict) -> str:
    """Byg den fulde kontekst-streng til Gemini."""
    ctx = ""

    if firm_text:
        ctx += f"═══ FIRMAINFORMATION ═══\n{firm_text}\n\n"

    if products:
        ctx += "═══ RELEVANTE PRODUKTER (brug KUN disse til anbefalinger) ═══\n"
        for i, p in enumerate(products[:4], 1):
            on_sale = ""
            if p.get("compareAtPriceMin") and p["compareAtPriceMin"] > p["priceMin"]:
                on_sale = f" (NEDSAT fra {p['compareAtPriceMin']:,.0f} kr.)".replace(",", ".")

            available = "✅ På lager" if p.get("availableForSale") else "❌ Ikke på lager"

            sizes = list(dict.fromkeys(
                v["size"] for v in p.get("variants", [])
                if v.get("availableForSale") and v.get("size")
            ))
            colors = list(dict.fromkeys(
                v["color"] for v in p.get("variants", [])
                if v.get("availableForSale") and v.get("color")
            ))

            img = p.get("images", [{}])[0].get("url", "Ingen billede") if p.get("images") else "Ingen billede"

            ctx += f"""
PRODUKT {i}: {p['title']}
- Pris: {p['priceMin']:,.0f} kr.{on_sale}
- Mærke: {p.get('vendor', '')}
- Type: {p.get('productType', '')}
- Lager: {available}
- Billede: {img}
- Link: {p.get('url', '')}
- Beskrivelse: {(p.get('description') or '')[:200]}...
- Tilgængelige størrelser: {', '.join(sizes) or 'Se produktsiden'}
- Farver: {', '.join(colors) or 'Se produktsiden'}
- Tags: {', '.join(p.get('tags', []))}
"""

    # Størrelsesvejledning
    height = intent.get("heightCm")
    if height:
        if height < 160:
            size_rec = "XS-S (ramme ca. 44-49 cm)"
        elif height < 170:
            size_rec = "S-M (ramme ca. 49-52 cm)"
        elif height < 180:
            size_rec = "M (ramme ca. 52-56 cm)"
        elif height < 190:
            size_rec = "L (ramme ca. 56-58 cm)"
        else:
            size_rec = "XL (ramme ca. 58-62 cm)"
        ctx += f"\n═══ STØRRELSESVEJLEDNING ═══\nKunden er {height} cm høj. Anbefalet størrelse: {size_rec}\n"

    return ctx


def _should_suggest_lead(messages: list, intent: dict) -> bool:
    """Bestem om chatbotten skal foreslå lead-indsamling."""
    last = (messages[-1].get("content") or "").lower()
    return (
        intent.get("wantsContact")
        or intent.get("wantsTestRide")
        or "kontakt" in last
        or "ring" in last
        or "tal med" in last
        or "testkørs" in last
        or len(messages) >= 6
    )


# ─── Hoved RAG funktion ───────────────────────────────────────

def run_rag_pipeline(messages: list) -> dict:
    """
    Kør komplet RAG pipeline.
    Returnerer: { message, products, suggestLead, intent }
    """
    import time
    t0 = time.time()
    user_msg = (messages[-1].get("content") or "") if messages else ""
    logger.info(f'[RAG] Behandler: "{user_msg[:80]}..."')

    # Step 1: Intent
    t1 = time.time()
    intent = extract_intent(user_msg, messages[:-1])
    t2 = time.time()
    logger.info(f"[RAG] Intent: {intent} (tog {t2-t1:.2f}s)")

    # Step 2: Produktsøgning
    products = []
    is_product_q = (
        intent.get("bikeType")
        or intent.get("purpose")
        or intent.get("brand")
        or (intent.get("searchKeywords") and len(intent["searchKeywords"]) > 0)
        or not intent.get("isGeneralQuestion")
    )

    t4 = t2
    if is_product_q:
        query = _build_search_query(intent, user_msg)
        budget_max = intent.get("budgetMax") or intent.get("budget")
        filters = {
            "maxPrice": budget_max,
            "availableOnly": True,
            "productType": intent.get("bikeType"),
        }
        logger.info(f'[RAG] Søger: "{query}" med filtre: {filters}')
        t3 = time.time()
        products = search_products(query, filters, limit=4)
        t4 = time.time()
        logger.info(f"[RAG] Fandt {len(products)} produkter (tog {t4-t3:.2f}s)")

    # Step 3: Firmainformation
    firm_text = _search_firm_info(user_msg)

    # Step 4: Byg kontekst
    context = _build_context(products, firm_text, intent)

    # Step 5: Generer svar
    t5 = time.time()
    ai_response = generate_response(messages, context)
    t6 = time.time()
    logger.info(f"[RAG] Genererede svar (tog {t6-t5:.2f}s)")

    logger.info(f"[RAG] Samlet tid: {time.time()-t0:.2f}s")

    # Step 6: Lead forslag
    suggest_lead = _should_suggest_lead(messages, intent)

    return {
        "message": ai_response,
        "products": products[:4],
        "suggestLead": suggest_lead,
        "intent": intent,
    }


def run_rag_pipeline_stream(messages: list):
    """
    Kør RAG pipeline og returner metadata samt stream generator.
    Returnerer: (metadata_dict, stream_generator)
    """
    import time
    t0 = time.time()
    user_msg = (messages[-1].get("content") or "") if messages else ""
    logger.info(f'[RAG Stream] Behandler: "{user_msg[:80]}..."')

    # Step 1: Intent
    t1 = time.time()
    intent = extract_intent(user_msg, messages[:-1])
    t2 = time.time()
    logger.info(f"[RAG Stream] Intent: {intent} (tog {t2-t1:.2f}s)")

    # Step 2: Produktsøgning
    products = []
    is_product_q = (
        intent.get("bikeType")
        or intent.get("purpose")
        or intent.get("brand")
        or (intent.get("searchKeywords") and len(intent["searchKeywords"]) > 0)
        or not intent.get("isGeneralQuestion")
    )

    t4 = t2
    if is_product_q:
        query = _build_search_query(intent, user_msg)
        budget_max = intent.get("budgetMax") or intent.get("budget")
        filters = {
            "maxPrice": budget_max,
            "availableOnly": True,
            "productType": intent.get("bikeType"),
        }
        logger.info(f'[RAG Stream] Søger: "{query}" med filtre: {filters}')
        t3 = time.time()
        products = search_products(query, filters, limit=4)
        t4 = time.time()
        logger.info(f"[RAG Stream] Fandt {len(products)} produkter (tog {t4-t3:.2f}s)")

    # Step 3: Firmainformation
    firm_text = _search_firm_info(user_msg)

    # Step 4: Byg kontekst
    context = _build_context(products, firm_text, intent)

    # Step 6: Lead forslag
    suggest_lead = _should_suggest_lead(messages, intent)

    metadata = {
        "products": products[:4],
        "suggestLead": suggest_lead,
        "intent": intent,
    }

    # Step 5: Generer svar stream
    logger.info(f"[RAG Stream] Starter streaming generation...")
    stream_generator = generate_response_stream(messages, context)

    logger.info(f"[RAG Stream] Samlet forberedelsestid: {time.time()-t0:.2f}s")

    return metadata, stream_generator

