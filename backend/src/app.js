// ============================================
// EXPRESS APP – Velohouse Chatbot Backend
// ============================================

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");

const chatRouter = require("./routes/chat");
const leadsRouter = require("./routes/leads");
const productsRouter = require("./routes/products");
const { generalLimiter } = require("./middleware/rateLimiter");
const { verifyEmailConnection } = require("./services/emailService");

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS Konfiguration ───────────────────────────────────────────

const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Tilføj altid localhost til dev
if (process.env.NODE_ENV !== "production") {
  allowedOrigins.push(
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://127.0.0.1:3000"
  );
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Tillad requests uden origin (Postman, server-side)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.some((o) => origin.endsWith(o.replace("https://", "")))
      ) {
        return callback(null, true);
      }
      console.warn(`[CORS] Afvist origin: ${origin}`);
      callback(new Error("CORS ikke tilladt"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);

// ─── Sikkerhedsheaders ────────────────────────────────────────────

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Håndteres af Shopify
  })
);

// ─── Middleware ───────────────────────────────────────────────────

app.use(compression());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(generalLimiter);

// Request logging
app.use((req, res, next) => {
  if (req.path !== "/api/health") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} | IP: ${req.ip}`);
  }
  next();
});

// ─── Routes ───────────────────────────────────────────────────────

app.use("/api/chat", chatRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/products", productsRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Velohouse Chatbot API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    mode: process.env.USE_MOCK_PRODUCTS === "true" ? "mock" : "shopify",
    environment: process.env.NODE_ENV || "development",
  });
});

// Root
app.get("/", (req, res) => {
  res.json({
    name: "Velohouse Chatbot API",
    version: "1.0.0",
    docs: "Se README.md for dokumentation",
    health: "/api/health",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint ikke fundet",
  });
});

// Global fejlhåndtering
app.use((err, req, res, next) => {
  console.error("[Server] Uventet fejl:", err.message);

  if (err.message === "CORS ikke tilladt") {
    return res.status(403).json({ success: false, error: "CORS ikke tilladt" });
  }

  res.status(500).json({
    success: false,
    error: "Intern serverfejl. Kontakt contact@velohouse.dk",
  });
});

// ─── Start Server ─────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log("\n╔═══════════════════════════════════════╗");
  console.log("║   🚴 Velohouse Chatbot Backend         ║");
  console.log("╠═══════════════════════════════════════╣");
  console.log(`║  URL:  http://localhost:${PORT}           ║`);
  console.log(`║  Mode: ${process.env.USE_MOCK_PRODUCTS === "true" ? "MOCK produkter (test)    " : "Shopify live data        "} ║`);
  console.log(`║  Env:  ${(process.env.NODE_ENV || "development").padEnd(24)} ║`);
  console.log("╚═══════════════════════════════════════╝\n");

  // Verificér email forbindelse ved opstart
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    await verifyEmailConnection();
  } else {
    console.warn("[Email] ⚠️  Gmail credentials ikke konfigureret – leads kan ikke sendes");
  }

  console.log("[Server] ✅ Server klar til at modtage requests\n");
});

module.exports = app;
