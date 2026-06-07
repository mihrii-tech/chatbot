// ============================================
// LEADS ROUTE – POST /api/leads
// ============================================

const express = require("express");
const router = express.Router();
const { sendLeadEmail } = require("../services/emailService");
const { leadLimiter } = require("../middleware/rateLimiter");
const { validateLead } = require("../middleware/validator");

/**
 * POST /api/leads
 * Body: { name, phone, email, interest, budget, bikeType, testDrive, conversation, gdprConsent }
 * Response: { success, message }
 */
router.post("/", leadLimiter, validateLead, async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      interest,
      budget,
      bikeType,
      testDrive,
      notes,
      conversation,
    } = req.body;

    // Validér at mindst email eller telefon er oplyst
    if (!email && !phone) {
      return res.status(400).json({
        success: false,
        error: "Angiv venligst enten email eller telefonnummer, så vi kan kontakte dig.",
      });
    }

    console.log(
      `[Lead] Nyt lead: ${name} | Email: ${email || "-"} | Telefon: ${phone || "-"} | IP: ${req.ip}`
    );

    // Send email til Velohouse
    await sendLeadEmail(
      { name, phone, email, interest, budget, bikeType, testDrive, notes },
      conversation || []
    );

    return res.json({
      success: true,
      message: `Tak, ${name}! Vi har modtaget din henvendelse og kontakter dig hurtigst muligt. 🚴`,
    });
  } catch (error) {
    console.error("[Lead] Fejl:", error.message);

    return res.status(500).json({
      success: false,
      error: "Din henvendelse kunne ikke sendes. Kontakt os direkte på contact@velohouse.dk",
    });
  }
});

module.exports = router;
