// ============================================
// RAG PIPELINE – Retrieval-Augmented Generation
// ============================================
// Flow:
// 1. Udtræk intent fra brugerens besked
// 2. Søg relevante produkter i Shopify/mock
// 3. Søg relevant firmainformation
// 4. Byg kontekst-streng til AI
// 5. Generer svar via Gemini

const { extractIntent, generateResponse } = require("./gemini");
const { searchProducts } = require("./shopify");
const firmInfo = require("../data/firmInfo");

// ─── Firmainformation søgning ─────────────────────────────────────

/**
 * Find relevant firmainformation baseret på besked
 */
function searchFirmInfo(message) {
  const msg = message.toLowerCase();
  const sections = [];

  // Åbningstider
  if (
    msg.includes("åbningstid") ||
    msg.includes("åbent") ||
    msg.includes("hvornår") ||
    msg.includes("lukket")
  ) {
    sections.push(`ÅBNINGSTIDER: ${firmInfo.openingHours.description} ${firmInfo.openingHours.note}`);
  }

  // Kontakt / adresse
  if (
    msg.includes("kontakt") ||
    msg.includes("telefon") ||
    msg.includes("email") ||
    msg.includes("adresse") ||
    msg.includes("hvor ligger") ||
    msg.includes("butik")
  ) {
    sections.push(`KONTAKT & ADRESSE: ${firmInfo.contact.description} Email: ${firmInfo.contact.email} Website: ${firmInfo.contact.website}`);
  }

  // Levering
  if (
    msg.includes("lever") ||
    msg.includes("fragt") ||
    msg.includes("forsendelse") ||
    msg.includes("shipping")
  ) {
    sections.push(`LEVERING: ${firmInfo.delivery.description} Leveringstid: ${firmInfo.delivery.time} ${firmInfo.delivery.note}`);
  }

  // Retur / returret
  if (
    msg.includes("retur") ||
    msg.includes("bytte") ||
    msg.includes("fortryd") ||
    msg.includes("refunder")
  ) {
    sections.push(`RETURREGLER: ${firmInfo.returns.description} ${firmInfo.returns.conditions} ${firmInfo.returns.process}`);
  }

  // Garanti
  if (
    msg.includes("garanti") ||
    msg.includes("reklamation") ||
    msg.includes("defekt") ||
    msg.includes("fejl")
  ) {
    sections.push(`GARANTI: ${firmInfo.warranty.description} ${firmInfo.warranty.bikes} ${firmInfo.warranty.battery}`);
  }

  // Service og reparation
  if (
    msg.includes("service") ||
    msg.includes("reparation") ||
    msg.includes("mekaniker") ||
    msg.includes("eftersyn") ||
    msg.includes("vedligehold") ||
    msg.includes("punktering")
  ) {
    const serviceTypes = firmInfo.service.types.join(", ");
    sections.push(`SERVICE & REPARATION: ${firmInfo.service.description} Vi tilbyder: ${serviceTypes}. Priser: ${firmInfo.service.prices} Booking: ${firmInfo.service.booking}`);
  }

  // Testkørsel
  if (
    msg.includes("testkørs") ||
    msg.includes("prøvekørs") ||
    msg.includes("prøve cykel") ||
    msg.includes("test")
  ) {
    sections.push(`TESTKØRSEL: ${firmInfo.testRide.description} ${firmInfo.testRide.booking}`);
  }

  // Finansiering
  if (
    msg.includes("finansiering") ||
    msg.includes("lån") ||
    msg.includes("afbetal") ||
    msg.includes("kredit") ||
    msg.includes("rate")
  ) {
    sections.push(`FINANSIERING: ${firmInfo.financing.description} ${firmInfo.financing.note}`);
  }

  // Speed pedelec forklaring
  if (
    msg.includes("speed pedelec") ||
    msg.includes("45 km") ||
    msg.includes("45km") ||
    msg.includes("speed-pedelec")
  ) {
    const faq = firmInfo.faq.find((f) =>
      f.question.toLowerCase().includes("speed pedelec")
    );
    if (faq) sections.push(`SPEED PEDELEC INFO: ${faq.answer}`);
  }

  // Størrelse guide
  if (
    msg.includes("størrelse") ||
    msg.includes("højde") ||
    msg.includes("ramme") ||
    msg.includes("cm")
  ) {
    const faq = firmInfo.faq.find((f) =>
      f.question.toLowerCase().includes("størrelse")
    );
    if (faq) sections.push(`STØRRELSESGUIDE: ${faq.answer}`);
  }

  // Hvad er elcykel
  if (
    msg.includes("hvad er") && (msg.includes("elcykel") || msg.includes("el-cykel"))
  ) {
    const faq = firmInfo.faq.find((f) =>
      f.question.toLowerCase().includes("elcykel og normal")
    );
    if (faq) sections.push(`ELCYKEL INFO: ${faq.answer}`);
  }

  // Tilbud / rabat
  if (
    msg.includes("tilbud") ||
    msg.includes("rabat") ||
    msg.includes("sale") ||
    msg.includes("nedsat")
  ) {
    sections.push("TILBUD: Tjek velohouse.dk for aktuelle tilbud og kampagner. Nogle produkter har tilbudspriser markeret i vores sortiment.");
  }

  // Altid inkludér basis firmainformation
  sections.push(`VELOHOUSE BASIS INFO: ${firmInfo.name} - ${firmInfo.website} - Email: ${firmInfo.email}`);

  return sections.join("\n\n");
}

/**
 * Byg søgestreng baseret på intent
 */
function buildSearchQuery(intent, originalMessage) {
  const parts = [];

  if (intent.bikeType) parts.push(intent.bikeType);
  if (intent.purpose) parts.push(intent.purpose);
  if (intent.brand) parts.push(intent.brand);
  if (intent.color) parts.push(intent.color);
  if (intent.searchKeywords?.length > 0) {
    parts.push(...intent.searchKeywords.slice(0, 3));
  }

  // Fallback til original besked hvis ingen intent
  if (parts.length === 0) {
    return originalMessage.slice(0, 100);
  }

  return [...new Set(parts)].join(" ");
}

/**
 * Byg kontekst-streng til AI fra produkter og firmainformation
 */
function buildContext(products, firmInfoText, intent) {
  let context = "";

  // Firmainformation
  if (firmInfoText) {
    context += `═══ FIRMAINFORMATION ═══\n${firmInfoText}\n\n`;
  }

  // Produkter
  if (products && products.length > 0) {
    context += `═══ RELEVANTE PRODUKTER (brug KUN disse til anbefalinger) ═══\n`;
    products.slice(0, 4).forEach((p, i) => {
      const onSale =
        p.compareAtPriceMin && p.compareAtPriceMin > p.priceMin
          ? ` (NEDSAT fra ${p.compareAtPriceMin.toLocaleString("da-DK")} kr.)`
          : "";
      const available = p.availableForSale
        ? "✅ På lager"
        : "❌ Ikke på lager";

      // Find tilgængelige størrelser
      const availableSizes = p.variants
        ?.filter((v) => v.availableForSale && v.size)
        .map((v) => v.size)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .join(", ");

      // Find tilgængelige farver
      const availableColors = p.variants
        ?.filter((v) => v.availableForSale && v.color)
        .map((v) => v.color)
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .join(", ");

      context += `
PRODUKT ${i + 1}: ${p.title}
- Pris: ${p.priceMin.toLocaleString("da-DK")} kr.${onSale}
- Mærke: ${p.vendor}
- Type: ${p.productType}
- Lager: ${available}
- Billede: ${p.images?.[0]?.url || "Ingen billede"}
- Link: ${p.url}
- Beskrivelse: ${p.description?.slice(0, 200)}...
- Tilgængelige størrelser: ${availableSizes || "Se produktsiden"}
- Farver: ${availableColors || "Se produktsiden"}
- Tags: ${p.tags?.join(", ") || ""}
`;
    });
  }

  // Størrelsesvejledning baseret på højde
  if (intent?.heightCm) {
    const height = intent.heightCm;
    let sizeRec = "";
    if (height < 160) sizeRec = "XS-S (ramme ca. 44-49 cm)";
    else if (height < 170) sizeRec = "S-M (ramme ca. 49-52 cm)";
    else if (height < 180) sizeRec = "M (ramme ca. 52-56 cm)";
    else if (height < 190) sizeRec = "L (ramme ca. 56-58 cm)";
    else sizeRec = "XL (ramme ca. 58-62 cm)";

    context += `\n═══ STØRRELSESVEJLEDNING ═══\nKunden er ${height} cm høj. Anbefalet størrelse: ${sizeRec}\n`;
  }

  return context;
}

/**
 * Bestem om chatbotten skal foreslå lead-indsamling
 */
function shouldSuggestLead(messages, intent) {
  const lastMessage =
    messages[messages.length - 1]?.content?.toLowerCase() || "";

  return (
    intent?.wantsContact ||
    intent?.wantsTestRide ||
    lastMessage.includes("kontakt") ||
    lastMessage.includes("ring") ||
    lastMessage.includes("tal med") ||
    lastMessage.includes("testkørs") ||
    lastMessage.includes("prøvekørs") ||
    messages.length >= 6 // Foreslå lead efter 6+ beskeder
  );
}

// ─── Hoved RAG funktion ────────────────────────────────────────────

/**
 * Kør komplet RAG pipeline
 * @param {Array} messages - Samtalehistorik [{role, content}]
 * @returns {object} { message, products, suggestLead }
 */
async function runRAGPipeline(messages) {
  const userMessage = messages[messages.length - 1]?.content || "";

  console.log(`[RAG] Behandler: "${userMessage.slice(0, 80)}..."`);

  // STEP 1: Udtræk intent
  const intent = await extractIntent(userMessage, messages.slice(0, -1));
  console.log("[RAG] Intent:", JSON.stringify(intent));

  // STEP 2: Søg produkter (hvis relevant)
  let products = [];
  const isProductQuestion =
    intent.bikeType ||
    intent.purpose ||
    intent.brand ||
    (intent.searchKeywords && intent.searchKeywords.length > 0) ||
    !intent.isGeneralQuestion;

  if (isProductQuestion) {
    const searchQuery = buildSearchQuery(intent, userMessage);
    const filters = {
      maxPrice: intent.budgetMax || intent.budget ? (intent.budgetMax || intent.budget) : null,
      availableOnly: true,
      productType: intent.bikeType || null,
    };

    console.log(`[RAG] Søger produkter: "${searchQuery}"`, filters);
    products = await searchProducts(searchQuery, filters, 4);
    console.log(`[RAG] Fandt ${products.length} produkter`);
  }

  // STEP 3: Søg firmainformation
  const firmInfoText = searchFirmInfo(userMessage);

  // STEP 4: Byg kontekst
  const context = buildContext(products, firmInfoText, intent);

  // STEP 5: Generer AI-svar
  const aiResponse = await generateResponse(messages, context);

  // STEP 6: Bestem om lead skal foreslås
  const suggestLead = shouldSuggestLead(messages, intent);

  return {
    message: aiResponse,
    products: products.slice(0, 4),
    suggestLead,
    intent, // Til debug
  };
}

module.exports = { runRAGPipeline };
