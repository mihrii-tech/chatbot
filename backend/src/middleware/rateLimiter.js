// ============================================
// RATE LIMITER MIDDLEWARE
// ============================================

const rateLimit = require("express-rate-limit");

// Chat endpoint: 20 requests per minut per IP
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minut
  max: 20,
  message: {
    success: false,
    error: "Du har sendt for mange beskeder. Vent venligst et øjeblik og prøv igen.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === "test",
});

// Lead endpoint: 5 requests per 10 minutter per IP
const leadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutter
  max: 5,
  message: {
    success: false,
    error: "For mange henvendelser. Vent venligst 10 minutter og prøv igen.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Produkt søgning: 60 requests per minut
const productLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: {
    success: false,
    error: "For mange produktsøgninger. Prøv igen om et øjeblik.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Generel API: 100 requests per minut
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: "For mange requests. Prøv igen om et øjeblik.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  chatLimiter,
  leadLimiter,
  productLimiter,
  generalLimiter,
};
