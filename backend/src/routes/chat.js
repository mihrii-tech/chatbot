// ============================================
// CHAT ROUTE – POST /api/chat
// ============================================

const express = require("express");
const router = express.Router();
const { runRAGPipeline } = require("../services/rag");
const { chatLimiter } = require("../middleware/rateLimiter");
const { validateChat } = require("../middleware/validator");

/**
 * POST /api/chat
 * Body: { messages: [{role, content}], sessionId }
 * Response: { success, message, products, suggestLead }
 */
router.post("/", chatLimiter, validateChat, async (req, res) => {
  const startTime = Date.now();

  try {
    const { messages, sessionId } = req.body;

    // Sikr at den seneste besked er fra user
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      return res.status(400).json({
        success: false,
        error: "Den seneste besked skal være fra 'user'",
      });
    }

    console.log(
      `[Chat] Session: ${sessionId || "anon"} | Beskeder: ${messages.length} | IP: ${req.ip}`
    );

    // Kør RAG pipeline
    const result = await runRAGPipeline(messages);

    const responseTime = Date.now() - startTime;
    console.log(`[Chat] Svar genereret på ${responseTime}ms`);

    return res.json({
      success: true,
      message: result.message,
      products: result.products || [],
      suggestLead: result.suggestLead || false,
      responseTime,
    });
  } catch (error) {
    console.error("[Chat] Fejl:", error.message);

    // Brugervenlig fejlbesked
    const userMessage = error.message?.includes("AI-tjenesten")
      ? error.message
      : "Beklager, jeg oplever tekniske problemer. Prøv igen om et øjeblik, eller kontakt os direkte på contact@velohouse.dk 🙏";

    return res.status(500).json({
      success: false,
      error: userMessage,
      message: userMessage,
    });
  }
});

module.exports = router;
