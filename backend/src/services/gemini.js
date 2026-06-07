// ============================================
// GOOGLE GEMINI AI SERVICE
// ============================================

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Brug gemini-2.0-flash-lite (tilgængelig på gratis tier)
const CHAT_MODEL = "gemini-2.5-flash";
const INTENT_MODEL = "gemini-2.5-flash";

const chatModel = genAI.getGenerativeModel({ model: CHAT_MODEL });
const intentModel = genAI.getGenerativeModel({ model: INTENT_MODEL });

// ─── System Prompt ────────────────────────────────────────────────

const SYSTEM_PROMPT = `Du er Velohouse.dk's professionelle AI-salgsassistent. Velohouse er en specialiseret cykelforretning i Danmark, der sælger cykler, elcykler, ladcykler, speed pedelecs, tilbehør, cykelpleje og beklædning, samt tilbyder service/reparation og testkørsel.

REGLER DU ALTID SKAL FØLGE:
1. Svar ALTID på dansk – naturligt, venligt og professionelt.
2. Du må KUN anbefale produkter, priser, lagerstatus og links der er oplyst i konteksten nedenfor. Du må ALDRIG opfinde produkter, priser, tilbud, lagerstatus eller specifikationer.
3. Hvis du ikke har sikker information, skal du ærligt sige: "Det kan jeg ikke se sikkert lige nu, men jeg kan sende din besked videre til Velohouse, så kontakter de dig." 
4. Hold svarene korte og præcise – max 3-5 sætninger medmindre kunden stiller komplekse spørgsmål.
5. Stil 2-4 korte opfølgende spørgsmål, hvis kundens behov ikke er tydeligt nok til at anbefale produkter.
6. Hvis kunden virker klar til køb, så anbefal relevante produkter fra konteksten.
7. Hvis kunden ønsker personlig rådgivning, testkørsel eller vil kontaktes, bed høfligt om: navn, telefon/email.
8. Spørgsmål om speed pedelecs: ALTID nævn at de kræver registrering, nummerplade, hjelm og forsikring i Danmark.
9. Vær specifik om produktnavne og priser – brug præcis de informationer fra konteksten.
10. Brug emojis sparsomt og professionelt (én eller to per svar er fint).

VELOHOUSE INFORMATION:
- Website: velohouse.dk
- Email: contact@velohouse.dk
- Vi tilbyder: cykler, elcykler, ladcykler, speed pedelecs, tilbehør, service og testkørsel
- Testkørsel: Tilbydes på udvalgte modeller – book via velohouse.dk eller contact@velohouse.dk`;

// ─── Hjælpefunktioner ─────────────────────────────────────────────

/**
 * Byg besked-historik til Gemini (seneste 8 beskeder)
 */
function buildConversationHistory(messages) {
  return messages.slice(-8).map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
}

// ─── Offentlige funktioner ────────────────────────────────────────

/**
 * Udtræk intent fra brugerens besked
 * Returnerer struktureret objekt med kundens behov
 */
async function extractIntent(userMessage, conversationHistory = []) {
  const intentPrompt = `Analyser denne besked fra en cykelbutik-kunde og returner KUN et JSON-objekt (ingen markdown, ingen forklaring).

Besked: "${userMessage}"

Returner dette JSON-format:
{
  "bikeType": null,        // "elcykel" | "ladcykel" | "speed-pedelec" | "mountainbike" | "citybike" | "hybridcykel" | "racercykel" | "børnecykel" | "gravel" | null
  "budget": null,          // Tal i DKK eller null (eks. 15000)
  "budgetMax": null,       // Maksimum budget i DKK eller null
  "purpose": null,         // "pendling" | "sport" | "familie" | "børn" | "bykørsel" | "motion" | "bakker" | "lang-tur" | null
  "heightCm": null,        // Kundens højde i cm eller null
  "brand": null,           // Specifikt mærke eller null
  "color": null,           // Ønsket farve eller null
  "size": null,            // "XS" | "S" | "M" | "L" | "XL" | null
  "needsService": false,   // true/false
  "wantsTestRide": false,  // true/false
  "wantsContact": false,   // true/false
  "isGeneralQuestion": false, // true hvis det er et generelt spørgsmål (levering, garanti osv.)
  "searchKeywords": []     // Array af søgeord til produktsøgning
}`;

  try {
    const result = await intentModel.generateContent(intentPrompt);
    const text = result.response.text().trim();

    // Fjern eventuelle markdown-blokke
    const cleanText = text
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/gi, "")
      .trim();

    return JSON.parse(cleanText);
  } catch (err) {
    console.error("[Gemini] Intent extraction fejl:", err.message);
    // Returnér default intent ved fejl
    return {
      bikeType: null,
      budget: null,
      budgetMax: null,
      purpose: null,
      heightCm: null,
      brand: null,
      searchKeywords: [userMessage.slice(0, 50)],
      isGeneralQuestion: true,
    };
  }
}

/**
 * Generer AI-svar med kontekst (RAG)
 * @param {Array} messages - Samtalens historik
 * @param {string} context - Produkter og firmainformation
 */
async function generateResponse(messages, context) {
  try {
    const history = buildConversationHistory(messages.slice(0, -1));
    const lastMessage = messages[messages.length - 1];

    const fullPrompt = `${SYSTEM_PROMPT}

─── TILGÆNGELIG KONTEKST (brug KUN disse data) ───
${context}
─────────────────────────────────────────────────

Brugerens spørgsmål: ${lastMessage.content}

Husk: Svar på dansk, vær hjælpsom og anbefal kun produkter fra konteksten ovenfor.`;

    const chat = chatModel.startChat({ history });
    const result = await chat.sendMessage(fullPrompt);

    return result.response.text();
  } catch (error) {
    console.error("[Gemini] Chat fejl:", error.message);

    // Håndter rate limit og andre fejl
    if (error.message?.includes("429")) {
      throw new Error("AI-tjenesten er midlertidigt overbelastet. Prøv igen om et øjeblik.");
    }
    if (error.message?.includes("API_KEY")) {
      throw new Error("Konfigurationsfejl. Kontakt venligst Velohouse direkte på contact@velohouse.dk");
    }
    throw error;
  }
}

/**
 * Generer embedding til vektor-søgning
 * @param {string} text
 */
async function generateEmbedding(text) {
  const embeddingModel = genAI.getGenerativeModel({
    model: "text-embedding-004",
  });
  const result = await embeddingModel.embedContent(text);
  return result.embedding.values;
}

module.exports = {
  extractIntent,
  generateResponse,
  generateEmbedding,
  SYSTEM_PROMPT,
};
