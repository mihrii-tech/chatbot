// ============================================
// EMAIL SERVICE – Gmail SMTP via Nodemailer
// ============================================

const nodemailer = require("nodemailer");

let transporter = null;

/**
 * Initialiser Gmail transporter
 */
function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465;
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD;

  if (host) {
    transporter = nodemailer.createTransport({
      host: host,
      port: port,
      secure: port === 465,
      auth: {
        user: user,
        pass: pass,
      },
    });
  } else {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: user,
        pass: pass,
      },
    });
  }

  return transporter;
}

/**
 * Formater konversationshistorik til HTML
 */
function formatConversation(conversation = []) {
  if (!conversation || conversation.length === 0) {
    return "<p><em>Ingen samtalehistorik tilgængelig</em></p>";
  }

  return conversation
    .slice(-10) // Seneste 10 beskeder
    .map((msg) => {
      const role = msg.role === "user" ? "👤 Kunde" : "🤖 Chatbot";
      const bgColor = msg.role === "user" ? "#f0f4ff" : "#f0fff4";
      const content = (msg.content || "").replace(/\n/g, "<br>");
      return `
      <div style="margin-bottom:12px; padding:10px 14px; background:${bgColor}; border-radius:8px; border-left:3px solid ${msg.role === "user" ? "#4f46e5" : "#059669"};">
        <strong style="color:#374151;">${role}:</strong><br>
        <span style="color:#4b5563;">${content}</span>
      </div>`;
    })
    .join("");
}

/**
 * Send lead-email til Velohouse
 */
async function sendLeadEmail(leadData, conversation = []) {
  const {
    name,
    phone,
    email,
    interest,
    budget,
    bikeType,
    testDrive,
    notes,
  } = leadData;

  const emailTo = process.env.EMAIL_TO || "contact@velohouse.dk";
  const emailFrom = process.env.EMAIL_FROM || `Velohouse Chatbot <${process.env.GMAIL_USER}>`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#f9fafb; margin:0; padding:20px; }
    .container { max-width:600px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08); }
    .header { background:linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding:32px 40px; }
    .header h1 { color:#fff; margin:0; font-size:24px; font-weight:700; }
    .header p { color:#a5b4fc; margin:6px 0 0; font-size:14px; }
    .badge { display:inline-block; background:#00b894; color:#fff; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; margin-top:12px; }
    .body { padding:32px 40px; }
    .section { margin-bottom:28px; }
    .section h2 { color:#1a1a2e; font-size:16px; font-weight:700; margin:0 0 16px; padding-bottom:8px; border-bottom:2px solid #f3f4f6; }
    .field { display:flex; margin-bottom:12px; }
    .field-label { color:#6b7280; font-size:13px; min-width:140px; font-weight:500; }
    .field-value { color:#111827; font-size:14px; font-weight:600; }
    .conversation-box { background:#f9fafb; border-radius:12px; padding:20px; border:1px solid #e5e7eb; }
    .footer { background:#f9fafb; padding:20px 40px; border-top:1px solid #e5e7eb; text-align:center; }
    .footer p { color:#9ca3af; font-size:12px; margin:0; }
    .highlight { background:#fef3c7; padding:12px 16px; border-radius:8px; border-left:4px solid #f59e0b; margin-bottom:16px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚴 Nyt Lead fra Chatbot</h1>
      <p>Velohouse.dk AI-salgsassistent</p>
      <span class="badge">Ny henvendelse</span>
    </div>
    
    <div class="body">
      ${testDrive ? `<div class="highlight">⚡ <strong>Ønsker testkørsel!</strong> Kontakt kunden hurtigst muligt.</div>` : ""}
      
      <div class="section">
        <h2>👤 Kundeoplysninger</h2>
        <div class="field">
          <span class="field-label">Navn:</span>
          <span class="field-value">${name || "Ikke oplyst"}</span>
        </div>
        <div class="field">
          <span class="field-label">Telefon:</span>
          <span class="field-value">${phone || "Ikke oplyst"}</span>
        </div>
        <div class="field">
          <span class="field-label">Email:</span>
          <span class="field-value">${email || "Ikke oplyst"}</span>
        </div>
      </div>
      
      <div class="section">
        <h2>🛒 Kundens Behov</h2>
        <div class="field">
          <span class="field-label">Interesseret i:</span>
          <span class="field-value">${interest || "Ikke specificeret"}</span>
        </div>
        <div class="field">
          <span class="field-label">Cykeltype:</span>
          <span class="field-value">${bikeType || "Ikke specificeret"}</span>
        </div>
        <div class="field">
          <span class="field-label">Budget:</span>
          <span class="field-value">${budget ? `${Number(budget).toLocaleString("da-DK")} kr.` : "Ikke oplyst"}</span>
        </div>
        <div class="field">
          <span class="field-label">Testkørsel:</span>
          <span class="field-value">${testDrive ? "✅ Ja, ønsker testkørsel" : "❌ Ikke ønsket"}</span>
        </div>
        ${notes ? `<div class="field"><span class="field-label">Ekstra noter:</span><span class="field-value">${notes}</span></div>` : ""}
      </div>
      
      <div class="section">
        <h2>💬 Samtalehistorik</h2>
        <div class="conversation-box">
          ${formatConversation(conversation)}
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>Modtaget: ${new Date().toLocaleString("da-DK", { timeZone: "Europe/Copenhagen" })}</p>
      <p>Sendt fra Velohouse AI Chatbot • velohouse.dk</p>
      <p style="margin-top:8px; font-size:11px; color:#d1d5db;">Dette lead er genereret automatisk. Oplysninger bruges til at kontakte kunden.</p>
    </div>
  </div>
</body>
</html>`;

  const mailOptions = {
    from: emailFrom,
    to: emailTo,
    replyTo: email || undefined,
    subject: `🚴 Nyt chatbot-lead: ${name || "Ukendt kunde"} – ${interest || bikeType || "Generel henvendelse"}`,
    html: htmlContent,
    text: `
Nyt lead fra Velohouse Chatbot
================================
Navn: ${name || "Ikke oplyst"}
Telefon: ${phone || "Ikke oplyst"}
Email: ${email || "Ikke oplyst"}
Interesseret i: ${interest || "Ikke specificeret"}
Cykeltype: ${bikeType || "Ikke specificeret"}
Budget: ${budget ? `${budget} kr.` : "Ikke oplyst"}
Testkørsel: ${testDrive ? "Ja" : "Nej"}
Tidspunkt: ${new Date().toLocaleString("da-DK")}
    `.trim(),
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`[Email] Lead sendt: ${info.messageId} til ${emailTo}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("[Email] Fejl ved afsendelse:", error.message);
    throw new Error(`Kunne ikke sende email: ${error.message}`);
  }
}

/**
 * Test email forbindelsen
 */
async function verifyEmailConnection() {
  try {
    await getTransporter().verify();
    console.log("[Email] Gmail SMTP forbindelse OK");
    return true;
  } catch (error) {
    console.warn("[Email] Gmail SMTP forbindelsesfejl:", error.message);
    return false;
  }
}

module.exports = { sendLeadEmail, verifyEmailConnection };
