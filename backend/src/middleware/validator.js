// ============================================
// INPUT VALIDATOR MIDDLEWARE
// ============================================

const { body, validationResult } = require("express-validator");

/**
 * Returnerer validationsfejl som JSON
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: "Ugyldig input",
      details: errors.array().map((e) => e.msg),
    });
  }
  next();
};

// ─── Chat validering ─────────────────────────────────────────────

const validateChat = [
  body("messages")
    .isArray({ min: 1, max: 20 })
    .withMessage("Messages skal være et array med 1-20 beskeder"),
  body("messages.*.role")
    .isIn(["user", "assistant"])
    .withMessage("Rolle skal være 'user' eller 'assistant'"),
  body("messages.*.content")
    .isString()
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage("Besked skal være 1-2000 tegn"),
  body("sessionId")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("SessionId for langt"),
  handleValidationErrors,
];

// ─── Lead validering ─────────────────────────────────────────────

const validateLead = [
  body("name")
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Navn skal være 2-100 tegn"),
  body("email")
    .optional({ checkFalsy: true })
    .isEmail()
    .normalizeEmail()
    .withMessage("Ugyldig email-adresse"),
  body("phone")
    .optional({ checkFalsy: true })
    .isString()
    .trim()
    .matches(/^[\d\s+\-().]{6,20}$/)
    .withMessage("Ugyldigt telefonnummer"),
  body("interest")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Interest for lang"),
  body("budget")
    .optional({ checkFalsy: true })
    .isNumeric()
    .withMessage("Budget skal være et tal"),
  body("bikeType")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Cykeltypefeltet for langt"),
  body("testDrive")
    .optional()
    .isBoolean()
    .withMessage("testDrive skal være boolean"),
  body("conversation")
    .optional()
    .isArray({ max: 20 })
    .withMessage("Conversation max 20 beskeder"),
  body("gdprConsent")
    .equals("true")
    .withMessage("GDPR-samtykke er påkrævet"),
  handleValidationErrors,
];

// ─── Produkt søgning validering ───────────────────────────────────

const validateProductSearch = [
  body("query")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Søgeforespørgsel for lang"),
  handleValidationErrors,
];

module.exports = {
  validateChat,
  validateLead,
  validateProductSearch,
  handleValidationErrors,
};
