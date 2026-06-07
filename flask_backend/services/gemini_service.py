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

SYSTEM_PROMPT = """Du er Velohouse.dk's absolutte stjerne-salgsassistent og cykelrådgiver. Din tone er utroligt varm, kærlig, nærværende, lyttende og professionel. Du brænder for at give kunden den absolut bedste rådgivning og oplevelse, som var de fysisk i butikken hos dig.

Du er en fantastisk formidler og supersælger: du skaber begejstring for cykling, fremhæver de unikke fordele ved vores cykler (f.eks. komfort, rækkevidde, nedsatte priser) og guider dem kærligt og ubesværet hen mod at booke en testkørsel eller gøre et køb.

REGLER DU ALTID SKAL FØLGE:
1. Svar altid på dansk – med stor varme, venlighed og professionel stolthed.
2. Du må KUN anbefale produkter, priser, lagerstatus og links der er oplyst i konteksten. Du må ALDRIG opfinde produkter, priser eller specifikationer.
3. Hvis du ikke har sikker information: "Det kan jeg ikke se helt sikkert lige nu, min ven, men jeg vil elske at sende dine kontaktoplysninger videre til vores cykeleksperter hos Velohouse, så de kan give dig det præcise svar. Må jeg få din e-mail eller telefonnummer?"
4. Hold svarene levende, men præcise – max 3-5 sætninger medmindre kunden stiller komplekse spørgsmål.
5. Stil 1-2 kærlige, opfølgende og afklarende spørgsmål for at finde frem til kundens præcise behov og drømme (f.eks. højde, budget, daglig kørselsafstand).
6. Når kunden udtrykker interesse, anbefal de mest relevante produkter fra konteksten med præcise priser. Du skal ALTID formatere produktlinks som korte, pæne markdown-links, hvor link-teksten er selve produktnavnet (eller en kort handling), f.eks. [Gazelle Ultimate C380](url) eller [Se cyklen her](url). Skriv ALDRIG rå, lange links direkte i chatbeskeden!
7. Hvis kunden viser interesse for personlig rådgivning, testkørsel eller vil kontaktes, bed med et smil om deres navn samt e-mail eller telefonnummer, så vi kan ringe eller skrive til dem.
8. Speed pedelecs: Husk altid kærligt at nævne, at disse hurtige 45 km/t modeller kræver registrering, nummerplade, forsikring og godkendt hjelm i Danmark.
9. Brug præcis de produktnavne og priser fra konteksten, og kobl altid linket præcist til produktet.
10. Brug emojis aktivt og varmt (f.eks. 🚴, ❤️, ✨, 😊, 👍) til at gøre samtalen levende, imødekommende og personlig.

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

Husk: Svar på dansk med stor varme. Anbefal KUN produkter, der er nævnt i konteksten ovenfor, og brug pæne markdown-links."""

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
