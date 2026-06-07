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


# ─── Intent udtrækning ────────────────────────────────────────

def extract_intent(user_message: str, history: list = []) -> dict:
    """Analysér kundens besked og returnér struktureret intent."""
    prompt = f"""Analyser denne besked fra en cykelbutik-kunde og returner KUN et JSON-objekt (ingen markdown, ingen forklaring).

Besked: "{user_message}"

Returner præcis dette JSON-format:
{{
  "bikeType": null,
  "budget": null,
  "budgetMax": null,
  "purpose": null,
  "heightCm": null,
  "brand": null,
  "color": null,
  "size": null,
  "needsService": false,
  "wantsTestRide": false,
  "wantsContact": false,
  "isGeneralQuestion": false,
  "searchKeywords": []
}}

bikeType kan være: "elcykel" | "ladcykel" | "speed-pedelec" | "mountainbike" | "citybike" | "hybridcykel" | "racercykel" | "børnecykel" | "gravel" | null
purpose kan være: "pendling" | "sport" | "familie" | "børn" | "bykørsel" | "motion" | "bakker" | "lang-tur" | null
budget og budgetMax er tal i DKK eller null"""

    try:
        result = _get_client().models.generate_content(model=INTENT_MODEL, contents=prompt)
        text = result.text
        if not text:
            raise ValueError("Tomt svar modtaget fra Gemini")
        text = text.strip()
        # Fjern markdown code blocks hvis de er der
        clean = text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean)
    except Exception as e:
        logger.error(f"[Gemini] Intent fejl: {e}")
        return {
            "bikeType": None,
            "budget": None,
            "budgetMax": None,
            "purpose": None,
            "heightCm": None,
            "brand": None,
            "searchKeywords": [user_message[:50]],
            "isGeneralQuestion": True,
            "needsService": False,
            "wantsTestRide": False,
            "wantsContact": False,
        }


# ─── Svar generering ──────────────────────────────────────────

def generate_response(messages: list, context: str) -> str:
    """Generer AI-svar med RAG kontekst."""
    try:
        # Byg historik (seneste 8 beskeder, undtagen den sidste)
        history: list[types.Content | types.ContentDict] = []
        for msg in messages[-9:-1]:
            role = "model" if msg["role"] == "assistant" else "user"
            history.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))

        last_msg = messages[-1]["content"]
        full_prompt = f"""{SYSTEM_PROMPT}

─── TILGÆNGELIG KONTEKST (brug KUN disse data) ───
{context}
─────────────────────────────────────────────────

Brugerens spørgsmål: {last_msg}

Husk: Svar på dansk, vær hjælpsom og anbefal kun produkter fra konteksten ovenfor."""

        chat = _get_client().chats.create(model=CHAT_MODEL, history=history)
        result = chat.send_message(full_prompt)
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
