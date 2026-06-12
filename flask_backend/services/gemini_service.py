# ============================================================
# GOOGLE GEMINI AI SERVICE
# ============================================================

import os
import json
import logging
import google.genai as genai
from google.genai import types

logger = logging.getLogger(__name__)

# Lazy-initialisering – vi opretter klienten første gang den bruges,
# så dotenv er garanteret loadet inden da.
_client = None

def _get_client():
    global _client
    if _client is None:
        from dotenv import load_dotenv
        load_dotenv()
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key or api_key == "DIN_GEMINI_API_KEY_HER":
            raise RuntimeError("GEMINI_API_KEY er ikke sat i .env-filen!")
        _client = genai.Client(api_key=api_key)
    return _client

CHAT_MODEL = "gemini-2.5-flash"
INTENT_MODEL = "gemini-2.5-flash"

# ─── System Prompt ────────────────────────────────────────────

SYSTEM_PROMPT = """Du er Velohouse.dk's cykelrådgiver. Din tone er professionel, høflig, hjælpsom og engagerende. Svar altid som en professionel kundeservicemedarbejder. Sørg for at give kunden god, personlig rådgivning, men hold det struktureret.

REGLER DU ALTID SKAL FØLGE:
1. Svar altid på dansk – med venlighed, professionalisme og cykelglæde. Undgå uformelle eller overdrevent personlige tiltaleformer som "min ven", "kære" eller lignende.
2. Du må KUN anbefale produkter, priser, lagerstatus og links der er oplyst i konteksten. Du må ALDRIG opfinde detaljer selv.
3. Hvis du mangler info: "Det kan jeg desværre ikke se lige nu, men må jeg få din e-mail eller dit telefonnummer, så en af vores cykeleksperter kan kontakte dig med det samme?"
4. Svar altid meget KORT, præcist og direkte. Skriv højst 2-3 korte sætninger (eller ca. 4 linjer) pr. svar. Undgå lange forklaringer, medmindre kunden direkte beder om det.
5. Stil højst 1 venligt, opfølgende spørgsmål (og kun hvis det er nødvendigt for at sparre med kunden).
6. Når du anbefaler produkter, brug præcise priser og korte markdown-links med produktnavnet som linktekst, f.g. [Gazelle Ultimate C380](url). Skriv ALDRIG rå, lange links.
7. Hvis kunden vil kontaktes, booke testkørsel eller service, så bed om navn samt e-mail eller telefonnummer på en høflig måde.
8. Speed pedelecs: Husk kort at nævne, at 45 km/t modeller kræver nummerplade, forsikring og godkendt hjelm i Danmark.
9. Brug emojis moderat (f.g. 🚴, ✨, 😊) for at gøre samtalen indbydende, men hold det professionelt. Undgå hjerter (❤️) eller overdreven brug af emojis.

VELOHOUSE INFORMATION:
- Website: velohouse.dk
- Email: contact@velohouse.dk
- Vi tilbyder: cykler, elcykler, ladcykler, speed pedelecs, tilbehør, service og testkørsel
- Testkørsel: Tilbydes på udvalgte modeller – book via velohouse.dk eller contact@velohouse.dk
"""


# ─── Intent udtrækning (Hurtig lokal parser) ──────────────────

def extract_intent(user_message: str, history: list = []) -> dict:
    """Analysér kundens besked lokalt for at spare API-kald og reducere responstid."""
    import re
    
    msg = user_message.lower()
    
    # 1. Uddrag højde (f.eks. "jeg er 180 cm", "højde: 175")
    height_match = re.search(r'\b(1[4-9]\d|200)\s*(?:cm|centimeter)?\b', msg)
    height = int(height_match.group(1)) if height_match else None
    
    # 2. Uddrag budget (f.eks. "max 25000", "budget 20000 DKK")
    budget_match = re.search(r'\b(?:under|max|budget|omkring|ca\.?)\s*(\d{4,6})\b', msg)
    budget_max = int(budget_match.group(1)) if budget_match else None
    
    # 3. Match cykeltype
    bike_types = ["elcykel", "elcykler", "ladcykel", "ladcykler", "speed pedelec", "speed-pedelec", "speedpedelec", "mountainbike", "mtb", "citybike", "hybridcykel", "racercykel", "børnecykel", "børnecykler", "gravel"]
    bike_type = None
    for bt in bike_types:
        if bt in msg:
            if "børne" in bt:
                bike_type = "børnecykel"
            elif "lad" in bt:
                bike_type = "ladcykel"
            elif "speed" in bt:
                bike_type = "speed-pedelec"
            elif "el" in bt:
                bike_type = "elcykel"
            else:
                bike_type = bt
            break
            
    # 4. Match mærke
    brands = ["riese", "müller", "riese & müller", "riese and muller", "r&m", "cube", "gazelle", "trek", "specialized", "giro"]
    brand = None
    for b in brands:
        if b in msg:
            if b in ["riese", "müller", "riese & müller", "riese and muller", "r&m"]:
                brand = "Riese & Müller"
            else:
                brand = b.capitalize()
            break
            
    # 5. Match formål
    purposes = ["pendling", "pendle", "sport", "familie", "børn", "bykørsel", "motion", "bakker", "lang-tur", "langtur"]
    purpose = None
    for p in purposes:
        if p in msg:
            if "børn" in p:
                purpose = "børn"
            elif "pendl" in p:
                purpose = "pendling"
            else:
                purpose = p
            break
            
    # 6. Find søgeord (fjern stopord)
    stop_words = {"jeg", "har", "i", "en", "et", "og", "til", "er", "de", "den", "der", "med", "på", "for", "at", "af", "som", "om", "vi", "kan", "vil", "skal", "kunne", "ville", "skulle", "hvad", "hvem", "hvor", "hvornår", "hvorfor", "hvordan", "ja", "nej", "hej", "goddag", "leder", "efter", "søger", "gerne", "finde", "købe", "nogle"}
    words = re.findall(r'\b[a-zA-ZæøåÆØÅ]{3,15}\b', msg)
    keywords = [w for w in words if w not in stop_words]
    
    # 7. Lead indikatorer
    wants_contact = any(w in msg for w in ["kontakt", "ring", "skriv", "mail", "telefon", "tilsend", "ringes", "kontaktes"])
    wants_test_ride = any(w in msg for w in ["testkørs", "prøvekørs", "prøve cykel", "test ride", "prøvetur"])
    needs_service = any(w in msg for w in ["service", "reparation", "værksted", "eftersyn", "punkter", "lappe"])
    
    # 8. Generelt spørgsmål (hvis intet cykelrelateret eller hvis det er en hilsen)
    greetings = ["hej", "hejsa", "goddag", "davs", "dav", "hallo", "hello", "hi"]
    is_greeting = all(w in stop_words or w in greetings for w in words) if words else True
    is_general_info = any(w in msg for w in ["åbningstider", "adresse", "levering", "fragt", "retur", "garanti", "finansiering"])
    
    is_general = is_greeting or is_general_info or (not bike_type and not brand and not keywords)
    
    return {
        "bikeType": bike_type,
        "budget": budget_max,
        "budgetMax": budget_max,
        "purpose": purpose,
        "heightCm": height,
        "brand": brand,
        "color": None,
        "size": None,
        "needsService": needs_service,
        "wantsTestRide": wants_test_ride,
        "wantsContact": wants_contact,
        "isGeneralQuestion": is_general,
        "searchKeywords": keywords[:3]
    }


# ─── Svar generering ──────────────────────────────────────────

def generate_response(messages: list, context: str) -> str:
    """Generer AI-svar med RAG kontekst ved brug af direkte generate_content for lavere latency."""
    try:
        contents: list[types.Content] = []
        
        # Byg historik (seneste 8 beskeder, undtagen den sidste)
        for msg in messages[-9:-1]:
            role = "model" if msg["role"] == "assistant" else "user"
            contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))

        # Tilføj den aktuelle besked med RAG kontekst
        last_msg = messages[-1]["content"]
        user_prompt = f"""─── TILGÆNGELIG KONTEKST (brug KUN disse data til produktanbefalinger) ───
{context}
────────────────────────────────────────────────────────────────────────

Brugerens spørgsmål: {last_msg}

Husk: Svar på dansk, og vær altid høflig og professionel. Anbefal KUN produkter, der er nævnt i konteksten ovenfor, og brug pæne markdown-links."""

        contents.append(types.Content(role="user", parts=[types.Part(text=user_prompt)]))

        # Definer konfiguration med system_instruction
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.7,
        )

        # Generer svar direkte
        result = _get_client().models.generate_content(
            model=CHAT_MODEL,
            contents=contents,
            config=config
        )
        
        text = result.text
        if not text:
            raise RuntimeError("Intet svar modtaget fra Gemini")
        return text

    except Exception as e:
        logger.error(f"[Gemini] Chat fejl: {e}")
        err = str(e)
        if "429" in err:
            raise RuntimeError("AI-tjenesten er midlertidigt overbelastet. Prøv igen om et øjeblik.")
        if "401" in err or "UNAUTHENTICATED" in err:
            raise RuntimeError(
                "AI-konfigurationsfejl: Gemini API nøglen er ugyldig. "
                "Sæt en korrekt AIza... nøgle i .env filen."
            )
        if "API_KEY" in err.upper():
            raise RuntimeError("AI konfigurationsfejl. Kontakt venligst Velohouse på contact@velohouse.dk")
        raise


def generate_response_stream(messages: list, context: str):
    """Generer AI-svar som en stream med RAG kontekst."""
    try:
        contents: list[types.Content] = []
        
        # Byg historik (seneste 8 beskeder, undtagen den sidste)
        for msg in messages[-9:-1]:
            role = "model" if msg["role"] == "assistant" else "user"
            contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))

        # Tilføj den aktuelle besked med RAG kontekst
        last_msg = messages[-1]["content"]
        user_prompt = f"""─── TILGÆNGELIG KONTEKST (brug KUN disse data til produktanbefalinger) ───
{context}
────────────────────────────────────────────────────────────────────────

Brugerens spørgsmål: {last_msg}

Husk: Svar på dansk, og vær altid høflig og professionel. Anbefal KUN produkter, der er nævnt i konteksten ovenfor, og brug pæne markdown-links."""

        contents.append(types.Content(role="user", parts=[types.Part(text=user_prompt)]))

        # Definer konfiguration med system_instruction
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.7,
        )

        # Generer svar som stream
        response_stream = _get_client().models.generate_content_stream(
            model=CHAT_MODEL,
            contents=contents,
            config=config
        )
        return response_stream

    except Exception as e:
        logger.error(f"[Gemini] Chat stream fejl: {e}")
        err = str(e)
        if "429" in err:
            raise RuntimeError("AI-tjenesten er midlertidigt overbelastet. Prøv igen om et øjeblik.")
        if "401" in err or "UNAUTHENTICATED" in err:
            raise RuntimeError(
                "AI-konfigurationsfejl: Gemini API nøglen er ugyldig. "
                "Sæt en korrekt AIza... nøgle i .env filen."
            )
        if "API_KEY" in err.upper():
            raise RuntimeError("AI konfigurationsfejl. Kontakt venligst Velohouse på contact@velohouse.dk")
        raise

