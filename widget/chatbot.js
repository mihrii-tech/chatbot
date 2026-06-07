/**
 * ============================================================
 * VELOHOUSE.DK AI CHATBOT WIDGET
 * ============================================================
 * Et komplet chatbot-widget i ren Vanilla JavaScript.
 * Ingen afhængigheder – kan indsættes direkte på Shopify.
 *
 * Konfiguration: Sæt window.VelohouseChatConfig FØR dette script loades.
 * Eksempel:
 *   <script>
 *     window.VelohouseChatConfig = {
 *       apiUrl: 'https://din-backend.com',
 *       primaryColor: '#00b894',
 *     };
 *   </script>
 * ============================================================
 */

(function () {
  "use strict";

  // ─── Konfiguration ─────────────────────────────────────────────
  const CONFIG = Object.assign(
    {
      apiUrl: "http://localhost:3001",
      primaryColor: "#00b894",
      darkColor: "#1a1a2e",
      accentColor: "#00cec9",
      botName: "Velohouse AI",
      botAvatar: "🚴",
      welcomeMessage:
        "Hej! 👋 Jeg er din personlige cykelrådgiver hos Velohouse. Jeg kan hjælpe dig med at finde den perfekte cykel, svare på spørgsmål om service, levering og meget mere.\n\nHvad kan jeg hjælpe dig med i dag?",
      suggestedQuestions: [
        "Hvilken elcykel passer til mig?",
        "Hvad er en speed pedelec?",
        "Kan jeg booke testkørsel?",
        "Hvad koster service?",
      ],
    },
    window.VelohouseChatConfig || {}
  );

  const API_URL = CONFIG.apiUrl;

  // ─── State ─────────────────────────────────────────────────────
  let isOpen = false;
  let isLoading = false;
  let messages = [];
  let sessionId =
    localStorage.getItem("vh_session_id") || generateSessionId();
  let showLeadForm = false;
  let leadFormStep = "collecting"; // 'collecting' | 'sent'

  localStorage.setItem("vh_session_id", sessionId);

  // ─── Hjælpefunktioner ──────────────────────────────────────────

  function generateSessionId() {
    return "vh_" + Math.random().toString(36).substr(2, 9) + Date.now();
  }

  function formatPrice(price, currency = "DKK") {
    return (
      new Intl.NumberFormat("da-DK", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(price)
    );
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
  }

  function markdownToHtml(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/^/, "<p>")
      .replace(/$/, "</p>")
      .replace(/<p><\/p>/g, "");
  }

  // ─── CSS Injection ─────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById("vh-chatbot-styles")) return;

    const css = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

      :root {
        --vh-primary: ${CONFIG.primaryColor};
        --vh-dark: ${CONFIG.darkColor};
        --vh-accent: ${CONFIG.accentColor};
        --vh-white: #ffffff;
        --vh-gray-50: #f8fafc;
        --vh-gray-100: #f1f5f9;
        --vh-gray-200: #e2e8f0;
        --vh-gray-400: #94a3b8;
        --vh-gray-600: #475569;
        --vh-gray-800: #1e293b;
        --vh-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
        --vh-shadow-sm: 0 4px 16px rgba(0, 0, 0, 0.12);
        --vh-radius: 20px;
        --vh-radius-sm: 12px;
        --vh-font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        --vh-z: 999999;
      }

      /* ── Floating Button ── */
      #vh-chat-button {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--vh-primary) 0%, var(--vh-accent) 100%);
        border: none;
        cursor: pointer;
        z-index: var(--vh-z);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 32px rgba(0, 184, 148, 0.45);
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease;
        outline: none;
        font-size: 28px;
        line-height: 1;
      }

      #vh-chat-button:hover {
        transform: scale(1.1) translateY(-2px);
        box-shadow: 0 12px 40px rgba(0, 184, 148, 0.55);
      }

      #vh-chat-button:active {
        transform: scale(0.95);
      }

      #vh-chat-button .vh-pulse {
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: var(--vh-primary);
        opacity: 0.3;
        animation: vh-pulse 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
      }

      @keyframes vh-pulse {
        0% { transform: scale(1); opacity: 0.3; }
        70% { transform: scale(1.4); opacity: 0; }
        100% { transform: scale(1.4); opacity: 0; }
      }

      #vh-chat-button .vh-btn-icon {
        position: relative;
        z-index: 1;
        font-size: 26px;
        line-height: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.3s ease, opacity 0.3s ease;
      }

      #vh-chat-button .vh-btn-icon.hide {
        transform: scale(0) rotate(90deg);
        opacity: 0;
        position: absolute;
      }

      /* ── Badge ── */
      #vh-unread-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 20px;
        height: 20px;
        background: #ef4444;
        border-radius: 50%;
        font-size: 11px;
        font-weight: 700;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: var(--vh-font);
        border: 2px solid white;
        animation: vh-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      }

      @keyframes vh-bounce {
        from { transform: scale(0); }
        to { transform: scale(1); }
      }

      /* ── Chat Window ── */
      #vh-chat-window {
        position: fixed;
        bottom: 100px;
        right: 24px;
        width: 400px;
        height: 600px;
        max-height: calc(100vh - 120px);
        border-radius: var(--vh-radius);
        background: var(--vh-white);
        box-shadow: var(--vh-shadow);
        z-index: var(--vh-z);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: var(--vh-font);
        transform-origin: bottom right;
        animation: vh-window-open 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      }

      #vh-chat-window.closing {
        animation: vh-window-close 0.25s ease-in forwards;
      }

      @keyframes vh-window-open {
        from { transform: scale(0.5) translateY(40px); opacity: 0; }
        to { transform: scale(1) translateY(0); opacity: 1; }
      }

      @keyframes vh-window-close {
        from { transform: scale(1) translateY(0); opacity: 1; }
        to { transform: scale(0.5) translateY(40px); opacity: 0; }
      }

      /* ── Header ── */
      #vh-header {
        background: linear-gradient(135deg, var(--vh-dark) 0%, #16213e 100%);
        padding: 18px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
        position: relative;
      }

      #vh-header::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--vh-primary), transparent);
      }

      .vh-avatar {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--vh-primary), var(--vh-accent));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        flex-shrink: 0;
        position: relative;
      }

      .vh-avatar::after {
        content: '';
        position: absolute;
        bottom: 1px;
        right: 1px;
        width: 10px;
        height: 10px;
        background: #22c55e;
        border-radius: 50%;
        border: 2px solid var(--vh-dark);
      }

      .vh-header-info {
        flex: 1;
      }

      .vh-header-name {
        color: white;
        font-weight: 700;
        font-size: 15px;
        margin: 0;
        line-height: 1.2;
      }

      .vh-header-status {
        color: var(--vh-primary);
        font-size: 12px;
        font-weight: 500;
        margin: 2px 0 0;
      }

      .vh-header-actions {
        display: flex;
        gap: 6px;
      }

      .vh-header-btn {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: none;
        background: rgba(255,255,255,0.1);
        color: rgba(255,255,255,0.8);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
        font-size: 14px;
      }

      .vh-header-btn:hover {
        background: rgba(255,255,255,0.2);
        color: white;
      }

      /* ── Messages ── */
      #vh-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        scroll-behavior: smooth;
        background: var(--vh-gray-50);
      }

      #vh-messages::-webkit-scrollbar {
        width: 4px;
      }

      #vh-messages::-webkit-scrollbar-track {
        background: transparent;
      }

      #vh-messages::-webkit-scrollbar-thumb {
        background: var(--vh-gray-200);
        border-radius: 2px;
      }

      .vh-message {
        display: flex;
        gap: 8px;
        animation: vh-msg-appear 0.3s ease;
        max-width: 100%;
      }

      @keyframes vh-msg-appear {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .vh-message.user {
        flex-direction: row-reverse;
      }

      .vh-msg-avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        align-self: flex-end;
      }

      .vh-message.bot .vh-msg-avatar {
        background: linear-gradient(135deg, var(--vh-primary), var(--vh-accent));
      }

      .vh-message.user .vh-msg-avatar {
        background: var(--vh-gray-200);
        font-size: 13px;
      }

      .vh-msg-content {
        max-width: 78%;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .vh-msg-bubble {
        padding: 12px 16px;
        border-radius: 18px;
        font-size: 14px;
        line-height: 1.5;
        word-break: break-word;
      }

      .vh-message.bot .vh-msg-bubble {
        background: white;
        color: var(--vh-gray-800);
        border-bottom-left-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        border: 1px solid var(--vh-gray-100);
      }

      .vh-message.bot .vh-msg-bubble p {
        margin: 0 0 8px;
      }

      .vh-message.bot .vh-msg-bubble p:last-child {
        margin-bottom: 0;
      }

      .vh-message.user .vh-msg-bubble {
        background: linear-gradient(135deg, var(--vh-dark), #16213e);
        color: white;
        border-bottom-right-radius: 4px;
        box-shadow: 0 2px 8px rgba(26, 26, 46, 0.3);
      }

      .vh-msg-time {
        font-size: 11px;
        color: var(--vh-gray-400);
        padding: 0 4px;
      }

      .vh-message.user .vh-msg-time {
        text-align: right;
      }

      /* ── Typing Indicator ── */
      .vh-typing {
        display: flex;
        gap: 8px;
        align-items: center;
        animation: vh-msg-appear 0.3s ease;
      }

      .vh-typing-avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--vh-primary), var(--vh-accent));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        flex-shrink: 0;
        align-self: flex-end;
      }

      .vh-typing-bubble {
        background: white;
        border-radius: 18px;
        border-bottom-left-radius: 4px;
        padding: 12px 16px;
        display: flex;
        gap: 5px;
        align-items: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        border: 1px solid var(--vh-gray-100);
      }

      .vh-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--vh-primary);
        animation: vh-dots 1.2s infinite;
      }

      .vh-dot:nth-child(2) { animation-delay: 0.2s; }
      .vh-dot:nth-child(3) { animation-delay: 0.4s; }

      @keyframes vh-dots {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-6px); opacity: 1; }
      }

      /* ── Product Cards ── */
      .vh-products {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        margin-top: 4px;
      }

      .vh-product-card {
        background: white;
        border-radius: var(--vh-radius-sm);
        overflow: hidden;
        border: 1px solid var(--vh-gray-200);
        display: flex;
        transition: box-shadow 0.2s, transform 0.2s;
        text-decoration: none;
        cursor: default;
      }

      .vh-product-card:hover {
        box-shadow: 0 8px 24px rgba(0,0,0,0.1);
        transform: translateY(-1px);
      }

      .vh-product-img {
        width: 90px;
        height: 90px;
        object-fit: cover;
        flex-shrink: 0;
        background: var(--vh-gray-100);
      }

      .vh-product-img-placeholder {
        width: 90px;
        height: 90px;
        flex-shrink: 0;
        background: linear-gradient(135deg, var(--vh-gray-100), var(--vh-gray-200));
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
      }

      .vh-product-info {
        flex: 1;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
      }

      .vh-product-vendor {
        font-size: 10px;
        font-weight: 600;
        color: var(--vh-primary);
        text-transform: uppercase;
        letter-spacing: 0.8px;
      }

      .vh-product-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--vh-gray-800);
        line-height: 1.3;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .vh-product-price {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }

      .vh-price-current {
        font-size: 15px;
        font-weight: 700;
        color: var(--vh-dark);
      }

      .vh-price-old {
        font-size: 11px;
        color: var(--vh-gray-400);
        text-decoration: line-through;
      }

      .vh-price-badge {
        font-size: 10px;
        font-weight: 700;
        background: #fef2f2;
        color: #ef4444;
        padding: 1px 6px;
        border-radius: 4px;
      }

      .vh-product-stock {
        font-size: 11px;
        font-weight: 500;
        color: #22c55e;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .vh-product-stock.out {
        color: #ef4444;
      }

      .vh-product-cta {
        margin-top: auto;
        display: flex;
        gap: 6px;
        padding-top: 4px;
      }

      .vh-cta-btn {
        flex: 1;
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
        font-family: var(--vh-font);
        border: none;
        cursor: pointer;
        transition: all 0.2s;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }

      .vh-cta-btn.primary {
        background: linear-gradient(135deg, var(--vh-primary), var(--vh-accent));
        color: white;
      }

      .vh-cta-btn.primary:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      .vh-cta-btn.secondary {
        background: var(--vh-gray-100);
        color: var(--vh-gray-600);
      }

      .vh-cta-btn.secondary:hover {
        background: var(--vh-gray-200);
      }

      /* ── Suggested Questions ── */
      .vh-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 0 16px 8px;
      }

      .vh-suggestion-btn {
        padding: 6px 12px;
        border-radius: 20px;
        border: 1.5px solid var(--vh-primary);
        background: transparent;
        color: var(--vh-primary);
        font-size: 12px;
        font-weight: 500;
        font-family: var(--vh-font);
        cursor: pointer;
        transition: all 0.2s;
        white-space: nowrap;
      }

      .vh-suggestion-btn:hover {
        background: var(--vh-primary);
        color: white;
        transform: translateY(-1px);
      }

      /* ── Lead Form ── */
      .vh-lead-form {
        background: linear-gradient(135deg, #f0fdf4, #dcfce7);
        border: 1.5px solid #bbf7d0;
        border-radius: var(--vh-radius-sm);
        padding: 16px;
        margin: 4px 0;
      }

      .vh-lead-form h4 {
        color: var(--vh-dark);
        margin: 0 0 4px;
        font-size: 14px;
        font-weight: 700;
      }

      .vh-lead-form p {
        color: var(--vh-gray-600);
        font-size: 12px;
        margin: 0 0 12px;
        line-height: 1.4;
      }

      .vh-lead-field {
        margin-bottom: 8px;
      }

      .vh-lead-field input,
      .vh-lead-field select,
      .vh-lead-field textarea {
        width: 100%;
        padding: 8px 12px;
        border: 1.5px solid var(--vh-gray-200);
        border-radius: 8px;
        font-size: 13px;
        font-family: var(--vh-font);
        color: var(--vh-gray-800);
        background: white;
        transition: border-color 0.2s;
        box-sizing: border-box;
        outline: none;
      }

      .vh-lead-field input:focus,
      .vh-lead-field select:focus,
      .vh-lead-field textarea:focus {
        border-color: var(--vh-primary);
      }

      .vh-lead-field input::placeholder {
        color: var(--vh-gray-400);
      }

      .vh-lead-checkbox {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 12px;
      }

      .vh-lead-checkbox input[type="checkbox"] {
        width: 16px;
        height: 16px;
        margin-top: 2px;
        flex-shrink: 0;
        accent-color: var(--vh-primary);
      }

      .vh-lead-checkbox label {
        font-size: 11px;
        color: var(--vh-gray-600);
        line-height: 1.4;
        cursor: pointer;
      }

      .vh-lead-submit {
        width: 100%;
        padding: 10px;
        background: linear-gradient(135deg, var(--vh-primary), var(--vh-accent));
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        font-family: var(--vh-font);
        cursor: pointer;
        transition: all 0.2s;
      }

      .vh-lead-submit:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      .vh-lead-submit:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }

      /* ── Input Area ── */
      #vh-input-area {
        padding: 12px 16px;
        border-top: 1px solid var(--vh-gray-100);
        background: white;
        flex-shrink: 0;
      }

      .vh-input-row {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }

      #vh-input {
        flex: 1;
        padding: 10px 16px;
        border: 1.5px solid var(--vh-gray-200);
        border-radius: 24px;
        font-size: 14px;
        font-family: var(--vh-font);
        color: var(--vh-gray-800);
        outline: none;
        resize: none;
        min-height: 44px;
        max-height: 120px;
        transition: border-color 0.2s;
        line-height: 1.4;
        background: var(--vh-gray-50);
      }

      #vh-input:focus {
        border-color: var(--vh-primary);
        background: white;
      }

      #vh-input::placeholder {
        color: var(--vh-gray-400);
      }

      #vh-send-btn {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--vh-primary), var(--vh-accent));
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.2s;
        color: white;
      }

      #vh-send-btn:hover:not(:disabled) {
        transform: scale(1.08);
        box-shadow: 0 4px 12px rgba(0, 184, 148, 0.4);
      }

      #vh-send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .vh-send-icon {
        width: 18px;
        height: 18px;
      }

      .vh-input-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-top: 8px;
      }

      .vh-gdpr-text {
        font-size: 10px;
        color: var(--vh-gray-400);
        line-height: 1.3;
      }

      .vh-powered {
        font-size: 10px;
        color: var(--vh-gray-400);
        font-weight: 500;
      }

      /* ── Mobile ── */
      @media (max-width: 480px) {
        #vh-chat-window {
          bottom: 0;
          right: 0;
          left: 0;
          width: 100%;
          height: 100%;
          max-height: 100vh;
          border-radius: 0;
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
        }

        #vh-chat-button {
          bottom: 16px;
          right: 16px;
        }
      }

      /* ── Dark overlay on mobile ── */
      #vh-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        z-index: calc(var(--vh-z) - 1);
        animation: vh-fade-in 0.2s ease;
      }

      @keyframes vh-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @media (max-width: 480px) {
        #vh-overlay {
          display: block;
        }
      }
    `;

    const style = document.createElement("style");
    style.id = "vh-chatbot-styles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── HTML Templates ────────────────────────────────────────────

  function createButton() {
    const btn = document.createElement("button");
    btn.id = "vh-chat-button";
    btn.setAttribute("aria-label", "Åbn chatbot");
    btn.innerHTML = `
      <span class="vh-pulse"></span>
      <span class="vh-btn-icon" id="vh-btn-open">${CONFIG.botAvatar}</span>
      <span class="vh-btn-icon hide" id="vh-btn-close">✕</span>
    `;
    btn.addEventListener("click", toggleChat);
    return btn;
  }

  function createWindow() {
    const win = document.createElement("div");
    win.id = "vh-chat-window";
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-label", "Velohouse chatbot");

    win.innerHTML = `
      <div id="vh-header">
        <div class="vh-avatar">${CONFIG.botAvatar}</div>
        <div class="vh-header-info">
          <p class="vh-header-name">${CONFIG.botName}</p>
          <p class="vh-header-status">● Online – svarer normalt med det samme</p>
        </div>
        <div class="vh-header-actions">
          <button class="vh-header-btn" id="vh-minimize-btn" title="Minimer" aria-label="Minimer chat">─</button>
          <button class="vh-header-btn" id="vh-close-btn" title="Luk" aria-label="Luk chat">✕</button>
        </div>
      </div>
      <div id="vh-messages" role="log" aria-live="polite"></div>
      <div id="vh-suggestions-container"></div>
      <div id="vh-input-area">
        <div class="vh-input-row">
          <textarea
            id="vh-input"
            placeholder="Skriv dit spørgsmål..."
            rows="1"
            aria-label="Skriv en besked"
            maxlength="2000"
          ></textarea>
          <button id="vh-send-btn" aria-label="Send besked">
            <svg class="vh-send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
        <div class="vh-input-footer">
          <span class="vh-gdpr-text">🔒 Dine oplysninger behandles fortroligt jf. GDPR</span>
          <span class="vh-powered">AI af Velohouse</span>
        </div>
      </div>
    `;

    return win;
  }

  function createOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "vh-overlay";
    overlay.addEventListener("click", closeChat);
    return overlay;
  }

  // ─── Render funktioner ─────────────────────────────────────────

  function renderMessage(role, content, products = [], isLeadForm = false) {
    const messagesEl = document.getElementById("vh-messages");
    if (!messagesEl) return;

    const msgEl = document.createElement("div");
    msgEl.className = `vh-message ${role}`;

    const time = new Date().toLocaleTimeString("da-DK", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const avatarEmoji = role === "bot" ? CONFIG.botAvatar : "👤";

    let productsHtml = "";
    if (products && products.length > 0) {
      productsHtml = `<div class="vh-products">
        ${products
          .slice(0, 4)
          .map((p) => renderProductCard(p))
          .join("")}
      </div>`;
    }

    let leadFormHtml = "";
    if (isLeadForm) {
      leadFormHtml = renderLeadForm();
    }

    msgEl.innerHTML = `
      <div class="vh-msg-avatar">${avatarEmoji}</div>
      <div class="vh-msg-content">
        <div class="vh-msg-bubble">
          ${markdownToHtml(content)}
          ${productsHtml}
          ${leadFormHtml}
        </div>
        <span class="vh-msg-time">${time}</span>
      </div>
    `;

    messagesEl.appendChild(msgEl);

    // Tilføj event listeners til lead form
    if (isLeadForm) {
      setupLeadFormListeners(msgEl);
    }

    scrollToBottom();
  }

  function renderProductCard(product) {
    const imgHtml = product.images?.[0]?.url
      ? `<img class="vh-product-img" src="${escapeHtml(product.images[0].url)}" alt="${escapeHtml(product.images[0].altText || product.title)}" loading="lazy" onerror="this.outerHTML='<div class=\\'vh-product-img-placeholder\\'>🚴</div>'">`
      : `<div class="vh-product-img-placeholder">🚴</div>`;

    const isOnSale =
      product.compareAtPriceMin && product.compareAtPriceMin > product.priceMin;
    const discount = isOnSale
      ? Math.round(
          ((product.compareAtPriceMin - product.priceMin) /
            product.compareAtPriceMin) *
            100
        )
      : 0;

    const priceHtml = `
      <div class="vh-product-price">
        <span class="vh-price-current">${formatPrice(product.priceMin)}</span>
        ${isOnSale ? `<span class="vh-price-old">${formatPrice(product.compareAtPriceMin)}</span>` : ""}
        ${isOnSale ? `<span class="vh-price-badge">-${discount}%</span>` : ""}
      </div>
    `;

    const stockHtml = product.availableForSale
      ? `<span class="vh-product-stock">✓ På lager</span>`
      : `<span class="vh-product-stock out">✗ Udsolgt</span>`;

    const productUrl = product.url || "#";

    return `
      <div class="vh-product-card">
        ${imgHtml}
        <div class="vh-product-info">
          <span class="vh-product-vendor">${escapeHtml(product.vendor || "")}</span>
          <div class="vh-product-title" title="${escapeHtml(product.title)}">${escapeHtml(product.title)}</div>
          ${priceHtml}
          ${stockHtml}
          <div class="vh-product-cta">
            <a href="${escapeHtml(productUrl)}" target="_blank" rel="noopener noreferrer" class="vh-cta-btn primary">
              🔗 Se produkt
            </a>
            <button class="vh-cta-btn secondary" onclick="window.VHChatbot && window.VHChatbot.askAbout('${escapeHtml(product.title.replace(/'/g, "\\'"))}')">
              💬 Spørg om den
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderLeadForm() {
    return `
      <div class="vh-lead-form" id="vh-lead-form-container">
        <h4>📞 Bliv kontaktet af Velohouse</h4>
        <p>Udfyld formularen, og vi ringer/skriver til dig hurtigst muligt!</p>
        <div class="vh-lead-field">
          <input type="text" id="vh-lead-name" placeholder="Dit navn *" required autocomplete="name">
        </div>
        <div class="vh-lead-field">
          <input type="tel" id="vh-lead-phone" placeholder="Telefonnummer" autocomplete="tel">
        </div>
        <div class="vh-lead-field">
          <input type="email" id="vh-lead-email" placeholder="Email-adresse" autocomplete="email">
        </div>
        <div class="vh-lead-field">
          <input type="text" id="vh-lead-interest" placeholder="Hvad leder du efter? (valgfrit)">
        </div>
        <div class="vh-lead-checkbox">
          <input type="checkbox" id="vh-lead-testdrive">
          <label for="vh-lead-testdrive">Ja, jeg ønsker at booke en testkørsel 🚴</label>
        </div>
        <div class="vh-lead-checkbox">
          <input type="checkbox" id="vh-lead-gdpr" required>
          <label for="vh-lead-gdpr">Jeg accepterer, at Velohouse må kontakte mig på baggrund af mine oplysninger *</label>
        </div>
        <button class="vh-lead-submit" id="vh-lead-submit-btn" type="button">
          Send henvendelse →
        </button>
      </div>
    `;
  }

  function setupLeadFormListeners(container) {
    const submitBtn = container.querySelector("#vh-lead-submit-btn");
    if (!submitBtn) return;

    submitBtn.addEventListener("click", submitLeadForm);
  }

  function renderTypingIndicator() {
    const messagesEl = document.getElementById("vh-messages");
    if (!messagesEl) return;

    const typingEl = document.createElement("div");
    typingEl.id = "vh-typing";
    typingEl.className = "vh-typing";
    typingEl.innerHTML = `
      <div class="vh-typing-avatar">${CONFIG.botAvatar}</div>
      <div class="vh-typing-bubble">
        <div class="vh-dot"></div>
        <div class="vh-dot"></div>
        <div class="vh-dot"></div>
      </div>
    `;

    messagesEl.appendChild(typingEl);
    scrollToBottom();
    return typingEl;
  }

  function removeTypingIndicator() {
    const typing = document.getElementById("vh-typing");
    if (typing) typing.remove();
  }

  function renderSuggestions(questions) {
    const container = document.getElementById("vh-suggestions-container");
    if (!container) return;

    if (!questions || questions.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <div class="vh-suggestions">
        ${questions
          .map(
            (q) =>
              `<button class="vh-suggestion-btn" onclick="window.VHChatbot && window.VHChatbot.sendSuggestion('${escapeHtml(q.replace(/'/g, "\\'"))}')">${escapeHtml(q)}</button>`
          )
          .join("")}
      </div>
    `;
  }

  function scrollToBottom() {
    const messagesEl = document.getElementById("vh-messages");
    if (messagesEl) {
      setTimeout(() => {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }, 50);
    }
  }

  // ─── API Kald ──────────────────────────────────────────────────

  async function sendMessage(userText) {
    if (!userText.trim() || isLoading) return;

    isLoading = true;

    // Fjern suggestions
    renderSuggestions([]);

    // Tilføj til historik og render
    messages.push({ role: "user", content: userText });
    renderMessage("user", userText);

    // Input deaktivering
    const input = document.getElementById("vh-input");
    const sendBtn = document.getElementById("vh-send-btn");
    if (input) {
      input.value = "";
      input.disabled = true;
      input.style.height = "44px";
    }
    if (sendBtn) sendBtn.disabled = true;

    // Vis typing
    renderTypingIndicator();

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: messages.slice(-10), // Seneste 10 beskeder
          sessionId,
        }),
      });

      removeTypingIndicator();

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server fejl: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Ukendt fejl");
      }

      // Tilføj AI-svar til historik
      messages.push({ role: "assistant", content: data.message });

      // Render svar + produkter
      const shouldShowLeadForm =
        data.suggestLead && !showLeadForm && messages.length >= 4;
      renderMessage("bot", data.message, data.products || [], shouldShowLeadForm);

      if (shouldShowLeadForm) {
        showLeadForm = true;
      }
    } catch (error) {
      removeTypingIndicator();
      console.error("[VH Chatbot] Fejl:", error.message);

      const errMsg =
        error.message ||
        "Beklager, jeg kunne ikke svare. Prøv igen, eller skriv til contact@velohouse.dk 🙏";

      messages.push({ role: "assistant", content: errMsg });
      renderMessage("bot", errMsg);
    } finally {
      isLoading = false;
      if (input) input.disabled = false;
      if (sendBtn) sendBtn.disabled = false;
      if (input) input.focus();
    }
  }

  async function submitLeadForm() {
    const nameEl = document.getElementById("vh-lead-name");
    const phoneEl = document.getElementById("vh-lead-phone");
    const emailEl = document.getElementById("vh-lead-email");
    const interestEl = document.getElementById("vh-lead-interest");
    const testDriveEl = document.getElementById("vh-lead-testdrive");
    const gdprEl = document.getElementById("vh-lead-gdpr");
    const submitBtn = document.getElementById("vh-lead-submit-btn");

    if (!nameEl || !gdprEl) return;

    const name = nameEl.value.trim();
    const phone = phoneEl?.value.trim() || "";
    const email = emailEl?.value.trim() || "";
    const interest = interestEl?.value.trim() || "";
    const testDrive = testDriveEl?.checked || false;
    const gdprConsent = gdprEl?.checked || false;

    // Validér
    if (!name || name.length < 2) {
      nameEl.style.borderColor = "#ef4444";
      nameEl.focus();
      return;
    }

    if (!phone && !email) {
      alert("Angiv venligst enten telefonnummer eller email.");
      return;
    }

    if (!gdprConsent) {
      gdprEl.style.outline = "2px solid #ef4444";
      return;
    }

    // Send
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sender...";
    }

    try {
      const response = await fetch(`${API_URL}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          interest,
          testDrive,
          gdprConsent: "true",
          conversation: messages.slice(-8),
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Fjern formular og vis tak
        const formContainer = document.getElementById("vh-lead-form-container");
        if (formContainer) {
          formContainer.innerHTML = `
            <div style="text-align:center; padding:16px;">
              <div style="font-size:36px; margin-bottom:8px;">🎉</div>
              <h4 style="margin:0 0 6px; color:#166534;">Tak, ${escapeHtml(name)}!</h4>
              <p style="margin:0; color:#15803d; font-size:13px;">Vi har modtaget din henvendelse og kontakter dig hurtigst muligt.</p>
            </div>
          `;
        }
        leadFormStep = "sent";
      } else {
        throw new Error(data.error || "Fejl ved afsendelse");
      }
    } catch (error) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Prøv igen";
      }
      console.error("[Lead] Fejl:", error.message);
      alert(
        "Beklager, din henvendelse kunne ikke sendes. Skriv direkte til contact@velohouse.dk"
      );
    }
  }

  // ─── Chat Åbn/Luk ─────────────────────────────────────────────

  function openChat() {
    isOpen = true;

    // Opret vindue
    const win = createWindow();
    document.body.appendChild(win);

    // Overlay (mobil)
    const overlay = createOverlay();
    document.body.appendChild(overlay);

    // Setup input
    const input = document.getElementById("vh-input");
    const sendBtn = document.getElementById("vh-send-btn");

    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          const text = input.value.trim();
          if (text && !isLoading) sendMessage(text);
        }
      });

      // Auto-resize textarea
      input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 120) + "px";
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener("click", () => {
        const text = input?.value.trim() || "";
        if (text && !isLoading) sendMessage(text);
      });
    }

    // Luk-knapper
    document
      .getElementById("vh-close-btn")
      ?.addEventListener("click", closeChat);
    document
      .getElementById("vh-minimize-btn")
      ?.addEventListener("click", closeChat);

    // Fjern badge
    const badge = document.getElementById("vh-unread-badge");
    if (badge) badge.remove();

    // Skift knap-ikon
    document.getElementById("vh-btn-open")?.classList.add("hide");
    document.getElementById("vh-btn-close")?.classList.remove("hide");

    // Velkomstbesked (kun første gang)
    if (messages.length === 0) {
      renderMessage("bot", CONFIG.welcomeMessage);
      renderSuggestions(CONFIG.suggestedQuestions);
    } else {
      // Genrender tidligere beskeder
      const messagesEl = document.getElementById("vh-messages");
      if (messagesEl) messagesEl.innerHTML = "";
      messages.forEach((msg) => {
        renderMessage(msg.role === "user" ? "user" : "bot", msg.content);
      });
    }

    // Focus input
    setTimeout(() => input?.focus(), 300);
  }

  function closeChat() {
    if (!isOpen) return;
    isOpen = false;

    const win = document.getElementById("vh-chat-window");
    const overlay = document.getElementById("vh-overlay");

    if (win) {
      win.classList.add("closing");
      setTimeout(() => {
        win.remove();
        if (overlay) overlay.remove();
      }, 250);
    }

    // Skift knap-ikon
    document.getElementById("vh-btn-open")?.classList.remove("hide");
    document.getElementById("vh-btn-close")?.classList.add("hide");
  }

  function toggleChat() {
    if (isOpen) {
      closeChat();
    } else {
      openChat();
    }
  }

  // ─── Public API ────────────────────────────────────────────────

  window.VHChatbot = {
    open: openChat,
    close: closeChat,
    toggle: toggleChat,
    sendSuggestion: (text) => sendMessage(text),
    askAbout: (productName) =>
      sendMessage(`Fortæl mig mere om "${productName}"`),
  };

  // ─── Initialisering ────────────────────────────────────────────

  function init() {
    injectStyles();

    const button = createButton();
    document.body.appendChild(button);

    // Vis badge med velkomst efter 3 sekunder (ny besøgende)
    const hasVisited = localStorage.getItem("vh_visited");
    if (!hasVisited) {
      setTimeout(() => {
        if (!isOpen) {
          const badge = document.createElement("div");
          badge.id = "vh-unread-badge";
          badge.textContent = "1";
          button.appendChild(badge);

          // Vis tooltip
          button.setAttribute("title", "Hej! Kan jeg hjælpe dig med at finde den rigtige cykel? 🚴");

          localStorage.setItem("vh_visited", "true");
        }
      }, 3000);
    }

    console.log("[Velohouse Chatbot] ✅ Widget initialiseret");
  }

  // Start når DOM er klar
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
