/**
 * ============================================================
 * VELOHOUSE.DK AI CHATBOT WIDGET v2.0 (Flask Edition)
 * ============================================================
 * Ren Vanilla JavaScript – ingen afhængigheder.
 * Konfiguration: Sæt window.VelohouseChatConfig FØR dette script.
 *
 * Eksempel (Shopify):
 *   <script>
 *     window.VelohouseChatConfig = {
 *       apiUrl: 'https://din-server.com',
 *       primaryColor: '#00b894',
 *     };
 *   </script>
 *   <script src="chatbot.js" defer></script>
 * ============================================================
 */

(function () {
  "use strict";

  // ─── Konfiguration ─────────────────────────────────────────────
  const CONFIG = Object.assign(
    {
      apiUrl: "https://chatbot-3jao.onrender.com",
      primaryColor: "#00b894",
      darkColor: "#1a1a2e",
      accentColor: "#00cec9",
      botName: "Velohouse AI",
      botAvatar: "🚴",
      welcomeMessage:
        "Hej! 👋 Jeg er din personlige cykelrådgiver hos Velohouse.\n\nJeg kan hjælpe dig med at finde den perfekte cykel, svare på spørgsmål om levering, garanti, service og meget mere.\n\nHvad kan jeg hjælpe dig med i dag?",
      suggestedQuestions: [
        "Hvilken elcykel passer til mig?",
        "Hvad er en speed pedelec?",
        "Kan jeg booke testkørsel?",
        "Hvad koster service?",
      ],
    },
    window.VelohouseChatConfig || {}
  );

  const API = CONFIG.apiUrl.replace(/\/$/, "");

  // ─── State ─────────────────────────────────────────────────────
  let isOpen = false;
  let isLoading = false;
  let messages = [];
  let sessionId =
    (typeof localStorage !== "undefined" && localStorage.getItem("vh_session_id")) ||
    "vh_" + Math.random().toString(36).substr(2, 9) + Date.now();

  if (typeof localStorage !== "undefined") {
    localStorage.setItem("vh_session_id", sessionId);
  }

  // ─── Hjælpefunktioner ──────────────────────────────────────────

  function formatPrice(amount, currency) {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: currency || "DKK",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function markdownToHtml(text) {
    return text
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--vh-primary); font-weight:600; text-decoration:underline;">$1</a>')
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/^/, "<p>")
      .replace(/$/, "</p>")
      .replace(/<p><\/p>/g, "");
  }

  function timeStr() {
    return new Date().toLocaleTimeString("da-DK", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ─── CSS Injection ─────────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById("vh-styles")) return;
    const style = document.createElement("style");
    style.id = "vh-styles";
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

      :root {
        --vh-primary: ${CONFIG.primaryColor};
        --vh-dark: ${CONFIG.darkColor};
        --vh-accent: ${CONFIG.accentColor};
        --vh-font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        --vh-z: 999999;
        --vh-radius: 20px;
        --vh-radius-sm: 12px;
        --vh-shadow: 0 24px 64px rgba(0,0,0,0.22);
        --vh-gray-50: #f8fafc;
        --vh-gray-100: #f1f5f9;
        --vh-gray-200: #e2e8f0;
        --vh-gray-400: #94a3b8;
        --vh-gray-600: #475569;
        --vh-gray-800: #1e293b;
      }

      /* ── Floating Button ─────────────── */
      #vh-btn {
        position: fixed; bottom: 24px; right: 24px;
        width: 64px; height: 64px; border-radius: 50%;
        background: linear-gradient(135deg, var(--vh-primary) 0%, var(--vh-accent) 100%);
        border: none; cursor: pointer; z-index: var(--vh-z);
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 8px 32px rgba(0,184,148,0.45);
        transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s;
        outline: none;
      }
      #vh-btn:hover { transform: scale(1.1) translateY(-2px); box-shadow: 0 12px 40px rgba(0,184,148,0.55); }
      #vh-btn:active { transform: scale(0.95); }
      .vh-pulse {
        position: absolute; width: 100%; height: 100%; border-radius: 50%;
        background: var(--vh-primary); opacity: 0.3;
        animation: vh-pulse-anim 2s cubic-bezier(0.455,0.03,0.515,0.955) infinite;
      }
      @keyframes vh-pulse-anim {
        0% { transform: scale(1); opacity: 0.3; }
        70%, 100% { transform: scale(1.4); opacity: 0; }
      }
      .vh-btn-icon {
        position: relative; z-index: 1; font-size: 26px; line-height: 1;
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.3s ease, opacity 0.3s ease;
      }
      .vh-btn-icon.hide { transform: scale(0) rotate(90deg); opacity: 0; position: absolute; }

      #vh-badge {
        position: absolute; top: -4px; right: -4px;
        width: 20px; height: 20px; background: #ef4444;
        border-radius: 50%; font-size: 11px; font-weight: 700;
        color: white; display: flex; align-items: center; justify-content: center;
        font-family: var(--vh-font); border: 2px solid white;
        animation: vh-bounce 0.5s cubic-bezier(0.34,1.56,0.64,1);
      }
      @keyframes vh-bounce { from { transform: scale(0); } to { transform: scale(1); } }

      /* ── Chat Window ─────────────────── */
      #vh-window {
        position: fixed; bottom: 100px; right: 24px;
        width: 400px; height: 600px;
        max-height: calc(100vh - 120px);
        border-radius: var(--vh-radius);
        background: white;
        box-shadow: var(--vh-shadow);
        z-index: var(--vh-z);
        display: flex; flex-direction: column; overflow: hidden;
        font-family: var(--vh-font);
        transform-origin: bottom right;
        animation: vh-open 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards;
      }
      #vh-window.closing { animation: vh-close 0.25s ease-in forwards; }
      @keyframes vh-open { from { transform: scale(0.5) translateY(40px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
      @keyframes vh-close { from { transform: scale(1) translateY(0); opacity: 1; } to { transform: scale(0.5) translateY(40px); opacity: 0; } }

      /* ── Header ─────────────────────── */
      #vh-header {
        background: linear-gradient(135deg, var(--vh-dark) 0%, #16213e 100%);
        padding: 18px 20px;
        display: flex; align-items: center; gap: 12px;
        flex-shrink: 0; position: relative;
      }
      #vh-header::after {
        content: ''; position: absolute; bottom: 0; left: 0; right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, var(--vh-primary), transparent);
      }
      .vh-avatar {
        width: 42px; height: 42px; border-radius: 50%;
        background: linear-gradient(135deg, var(--vh-primary), var(--vh-accent));
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; flex-shrink: 0; position: relative;
      }
      .vh-avatar::after {
        content: ''; position: absolute; bottom: 1px; right: 1px;
        width: 10px; height: 10px; background: #22c55e;
        border-radius: 50%; border: 2px solid var(--vh-dark);
      }
      .vh-hdr-info { flex: 1; }
      .vh-hdr-name { color: white; font-weight: 700; font-size: 15px; margin: 0; line-height: 1.2; }
      .vh-hdr-status { color: var(--vh-primary); font-size: 12px; font-weight: 500; margin: 2px 0 0; }
      .vh-hdr-actions { display: flex; gap: 6px; }
      .vh-hdr-btn {
        width: 32px; height: 32px; border-radius: 50%; border: none;
        background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8);
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.2s; font-size: 14px;
      }
      .vh-hdr-btn:hover { background: rgba(255,255,255,0.2); color: white; }

      /* ── Messages ────────────────────── */
      #vh-messages {
        flex: 1; overflow-y: auto; padding: 16px;
        display: flex; flex-direction: column; gap: 12px;
        scroll-behavior: smooth; background: var(--vh-gray-50);
      }
      #vh-messages::-webkit-scrollbar { width: 4px; }
      #vh-messages::-webkit-scrollbar-track { background: transparent; }
      #vh-messages::-webkit-scrollbar-thumb { background: var(--vh-gray-200); border-radius: 2px; }

      .vh-msg {
        display: flex; gap: 8px;
        animation: vh-msg-in 0.3s ease; max-width: 100%;
      }
      @keyframes vh-msg-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .vh-msg.user { flex-direction: row-reverse; }
      .vh-msg-av {
        width: 30px; height: 30px; border-radius: 50%;
        flex-shrink: 0; display: flex; align-items: center; justify-content: center;
        font-size: 14px; align-self: flex-end;
      }
      .vh-msg.bot .vh-msg-av { background: linear-gradient(135deg, var(--vh-primary), var(--vh-accent)); }
      .vh-msg.user .vh-msg-av { background: var(--vh-gray-200); font-size: 13px; }
      .vh-msg-body { max-width: 78%; display: flex; flex-direction: column; gap: 6px; }
      .vh-bubble {
        padding: 12px 16px; border-radius: 18px;
        font-size: 14px; line-height: 1.5; word-break: break-word;
      }
      .vh-msg.bot .vh-bubble {
        background: white; color: var(--vh-gray-800);
        border-bottom-left-radius: 4px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        border: 1px solid var(--vh-gray-100);
      }
      .vh-msg.bot .vh-bubble p { margin: 0 0 8px; }
      .vh-msg.bot .vh-bubble p:last-child { margin-bottom: 0; }
      .vh-msg.user .vh-bubble {
        background: linear-gradient(135deg, var(--vh-dark), #16213e);
        color: white; border-bottom-right-radius: 4px;
        box-shadow: 0 2px 8px rgba(26,26,46,0.3);
      }
      .vh-msg-time { font-size: 11px; color: var(--vh-gray-400); padding: 0 4px; }
      .vh-msg.user .vh-msg-time { text-align: right; }

      /* ── Typing ──────────────────────── */
      .vh-typing { display: flex; gap: 8px; align-items: center; animation: vh-msg-in 0.3s ease; }
      .vh-typing-av {
        width: 30px; height: 30px; border-radius: 50%;
        background: linear-gradient(135deg, var(--vh-primary), var(--vh-accent));
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; flex-shrink: 0; align-self: flex-end;
      }
      .vh-typing-bbl {
        background: white; border-radius: 18px; border-bottom-left-radius: 4px;
        padding: 12px 16px; display: flex; gap: 5px; align-items: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06); border: 1px solid var(--vh-gray-100);
      }
      .vh-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--vh-primary); animation: vh-dots 1.2s infinite; }
      .vh-dot:nth-child(2) { animation-delay: 0.2s; }
      .vh-dot:nth-child(3) { animation-delay: 0.4s; }
      @keyframes vh-dots {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-6px); opacity: 1; }
      }

      /* ── Produkt Cards ───────────────── */
      .vh-products { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 4px; }
      .vh-product {
        background: white; border-radius: var(--vh-radius-sm);
        overflow: hidden; border: 1px solid var(--vh-gray-200);
        display: flex; transition: box-shadow 0.2s, transform 0.2s;
      }
      .vh-product:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.1); transform: translateY(-1px); }
      .vh-prod-img { width: 90px; height: 90px; object-fit: cover; flex-shrink: 0; background: var(--vh-gray-100); }
      .vh-prod-img-ph {
        width: 90px; height: 90px; flex-shrink: 0;
        background: linear-gradient(135deg, var(--vh-gray-100), var(--vh-gray-200));
        display: flex; align-items: center; justify-content: center; font-size: 28px;
      }
      .vh-prod-info { flex: 1; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; min-width: 0; }
      .vh-prod-vendor { font-size: 10px; font-weight: 600; color: var(--vh-primary); text-transform: uppercase; letter-spacing: 0.8px; }
      .vh-prod-title { font-size: 13px; font-weight: 600; color: var(--vh-gray-800); line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .vh-prod-price { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .vh-price { font-size: 15px; font-weight: 700; color: var(--vh-dark); }
      .vh-price-old { font-size: 11px; color: var(--vh-gray-400); text-decoration: line-through; }
      .vh-price-badge { font-size: 10px; font-weight: 700; background: #fef2f2; color: #ef4444; padding: 1px 6px; border-radius: 4px; }
      .vh-stock { font-size: 11px; font-weight: 500; color: #22c55e; display: flex; align-items: center; gap: 4px; }
      .vh-stock.out { color: #ef4444; }
      .vh-prod-cta { margin-top: auto; padding-top: 4px; }
      .vh-prod-link {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 6px 10px; border-radius: 8px;
        background: linear-gradient(135deg, var(--vh-primary), var(--vh-accent));
        color: white; font-size: 11px; font-weight: 600;
        font-family: var(--vh-font); text-decoration: none;
        transition: all 0.2s; border: none; cursor: pointer;
      }
      .vh-prod-link:hover { opacity: 0.9; transform: translateY(-1px); }

      /* ── Suggestions ─────────────────── */
      .vh-suggestions { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 8px; }
      .vh-sugg {
        padding: 6px 12px; border-radius: 20px;
        border: 1.5px solid var(--vh-primary); background: transparent;
        color: var(--vh-primary); font-size: 12px; font-weight: 500;
        font-family: var(--vh-font); cursor: pointer; transition: all 0.2s; white-space: nowrap;
      }
      .vh-sugg:hover { background: var(--vh-primary); color: white; transform: translateY(-1px); }

      /* ── Lead Form ───────────────────── */
      .vh-lead {
        background: linear-gradient(135deg, #f0fdf4, #dcfce7);
        border: 1.5px solid #bbf7d0; border-radius: var(--vh-radius-sm);
        padding: 16px; margin: 4px 0;
      }
      .vh-lead h4 { color: var(--vh-dark); margin: 0 0 4px; font-size: 14px; font-weight: 700; }
      .vh-lead p { color: var(--vh-gray-600); font-size: 12px; margin: 0 0 12px; line-height: 1.4; }
      .vh-lead-field { margin-bottom: 8px; }
      .vh-lead-field input, .vh-lead-field textarea {
        width: 100%; padding: 8px 12px;
        border: 1.5px solid var(--vh-gray-200); border-radius: 8px;
        font-size: 13px; font-family: var(--vh-font); color: var(--vh-gray-800);
        background: white; transition: border-color 0.2s; box-sizing: border-box; outline: none;
      }
      .vh-lead-field input:focus, .vh-lead-field textarea:focus { border-color: var(--vh-primary); }
      .vh-lead-field input::placeholder { color: var(--vh-gray-400); }
      .vh-lead-check { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px; }
      .vh-lead-check input[type="checkbox"] { width: 16px; height: 16px; margin-top: 2px; flex-shrink: 0; accent-color: var(--vh-primary); }
      .vh-lead-check label { font-size: 11px; color: var(--vh-gray-600); line-height: 1.4; cursor: pointer; }
      .vh-lead-submit {
        width: 100%; padding: 10px;
        background: linear-gradient(135deg, var(--vh-primary), var(--vh-accent));
        color: white; border: none; border-radius: 8px;
        font-size: 13px; font-weight: 600; font-family: var(--vh-font);
        cursor: pointer; transition: all 0.2s;
      }
      .vh-lead-submit:hover { opacity: 0.9; transform: translateY(-1px); }
      .vh-lead-submit:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
      .vh-lead-success {
        text-align: center; padding: 20px;
        background: linear-gradient(135deg, #f0fdf4, #dcfce7);
        border: 1.5px solid #bbf7d0; border-radius: var(--vh-radius-sm);
      }
      .vh-lead-success .icon { font-size: 32px; margin-bottom: 8px; }
      .vh-lead-success h4 { color: #166534; margin: 0 0 4px; font-size: 14px; font-weight: 700; }
      .vh-lead-success p { color: #374151; font-size: 12px; margin: 0; }

      /* ── Input Area ─────────────────── */
      #vh-input-area { padding: 12px 16px; border-top: 1px solid var(--vh-gray-100); background: white; flex-shrink: 0; }
      .vh-input-row { display: flex; gap: 8px; align-items: flex-end; }
      #vh-input {
        flex: 1; padding: 10px 16px;
        border: 1.5px solid var(--vh-gray-200); border-radius: 24px;
        font-size: 14px; font-family: var(--vh-font); color: var(--vh-gray-800);
        outline: none; resize: none; min-height: 44px; max-height: 120px;
        transition: border-color 0.2s; line-height: 1.4; background: white;
      }
      #vh-input:focus { border-color: var(--vh-primary); }
      #vh-input::placeholder { color: var(--vh-gray-400); }
      #vh-send {
        width: 44px; height: 44px; border-radius: 50%;
        background: linear-gradient(135deg, var(--vh-primary), var(--vh-accent));
        border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.2s; flex-shrink: 0;
        color: white; font-size: 18px;
      }
      #vh-send:hover { transform: scale(1.08); box-shadow: 0 4px 16px rgba(0,184,148,0.4); }
      #vh-send:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
      .vh-powered { text-align: center; font-size: 10px; color: var(--vh-gray-400); margin-top: 8px; }

      /* ── Responsive ─────────────────── */
      @media (max-width: 480px) {
        #vh-window { width: calc(100vw - 16px); right: 8px; bottom: 90px; height: calc(100vh - 110px); border-radius: 16px; }
        #vh-btn { bottom: 16px; right: 16px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── DOM Opbygning ─────────────────────────────────────────────

  function buildWidget() {
    // Floating button
    const btn = document.createElement("button");
    btn.id = "vh-btn";
    btn.setAttribute("aria-label", "Åbn Velohouse chatbot");
    btn.innerHTML = `
      <div class="vh-pulse"></div>
      <div class="vh-btn-icon" id="vh-icon-chat">🚴</div>
      <div class="vh-btn-icon hide" id="vh-icon-close">✕</div>
    `;
    document.body.appendChild(btn);

    btn.addEventListener("click", toggleChat);
  }

  function buildWindow() {
    const win = document.createElement("div");
    win.id = "vh-window";
    win.innerHTML = `
      <div id="vh-header">
        <div class="vh-avatar">${CONFIG.botAvatar}</div>
        <div class="vh-hdr-info">
          <p class="vh-hdr-name">${CONFIG.botName}</p>
          <p class="vh-hdr-status">● Online nu</p>
        </div>
        <div class="vh-hdr-actions">
          <button class="vh-hdr-btn" id="vh-clear-btn" title="Ny samtale">🔄</button>
          <button class="vh-hdr-btn" id="vh-close-btn" title="Luk">✕</button>
        </div>
      </div>
      <div id="vh-messages"></div>
      <div class="vh-suggestions" id="vh-suggestions"></div>
      <div id="vh-input-area">
        <div class="vh-input-row">
          <textarea id="vh-input" placeholder="Skriv dit spørgsmål..." rows="1"></textarea>
          <button id="vh-send" aria-label="Send">➤</button>
        </div>
        <div class="vh-powered">Drevet af Google Gemini AI • Velohouse.dk</div>
      </div>
    `;
    document.body.appendChild(win);

    document.getElementById("vh-close-btn").addEventListener("click", closeChat);
    document.getElementById("vh-clear-btn").addEventListener("click", clearConversation);
    document.getElementById("vh-send").addEventListener("click", sendMessage);

    const input = document.getElementById("vh-input");
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 120) + "px";
    });

    // Velkomstbesked
    addBotMessage(CONFIG.welcomeMessage);
    renderSuggestions(CONFIG.suggestedQuestions);
  }

  // ─── Toggle ────────────────────────────────────────────────────

  function toggleChat() {
    isOpen ? closeChat() : openChat();
  }

  function openChat() {
    isOpen = true;
    const iconChat = document.getElementById("vh-icon-chat");
    const iconClose = document.getElementById("vh-icon-close");
    iconChat.classList.add("hide");
    iconClose.classList.remove("hide");

    // Fjern badge
    const badge = document.getElementById("vh-badge");
    if (badge) badge.remove();

    let win = document.getElementById("vh-window");
    if (!win) {
      buildWindow();
      win = document.getElementById("vh-window");
    }
    win.classList.remove("closing");
    win.style.display = "flex";
    setTimeout(() => document.getElementById("vh-input")?.focus(), 400);
  }

  function closeChat() {
    isOpen = false;
    document.getElementById("vh-icon-chat")?.classList.remove("hide");
    document.getElementById("vh-icon-close")?.classList.add("hide");
    const win = document.getElementById("vh-window");
    if (win) {
      win.classList.add("closing");
      setTimeout(() => { win.style.display = "none"; }, 250);
    }
  }

  // ─── Beskeder ──────────────────────────────────────────────────

  function addBotMessage(text, products) {
    const container = document.getElementById("vh-messages");
    if (!container) return;

    const div = document.createElement("div");
    div.className = "vh-msg bot";
    div.innerHTML = `
      <div class="vh-msg-av">${CONFIG.botAvatar}</div>
      <div class="vh-msg-body">
        <div class="vh-bubble">${markdownToHtml(text)}</div>
        ${products && products.length ? renderProductCards(products) : ""}
        <div class="vh-msg-time">${timeStr()}</div>
      </div>
    `;
    container.appendChild(div);
    scrollBottom();

    // Vis badge hvis lukket
    if (!isOpen) showBadge();
  }

  function addUserMessage(text) {
    const container = document.getElementById("vh-messages");
    if (!container) return;

    const div = document.createElement("div");
    div.className = "vh-msg user";
    div.innerHTML = `
      <div class="vh-msg-av">👤</div>
      <div class="vh-msg-body">
        <div class="vh-bubble">${text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        <div class="vh-msg-time">${timeStr()}</div>
      </div>
    `;
    container.appendChild(div);
    scrollBottom();
  }

  function renderProductCards(products) {
    if (!products || !products.length) return "";
    const cards = products.slice(0, 3).map((p) => {
      const img = (p.images && p.images[0])
        ? `<img class="vh-prod-img" src="${p.images[0].url}" alt="${p.title}" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
        : "";
      const placeholder = `<div class="vh-prod-img-ph" ${img ? 'style="display:none"' : ""}>🚴</div>`;

      const onSale = p.compareAtPriceMin && p.compareAtPriceMin > p.priceMin;
      const savings = onSale
        ? Math.round(((p.compareAtPriceMin - p.priceMin) / p.compareAtPriceMin) * 100)
        : 0;

      return `
        <div class="vh-product">
          ${img}${placeholder}
          <div class="vh-prod-info">
            <div class="vh-prod-vendor">${p.vendor || ""}</div>
            <div class="vh-prod-title" title="${p.title}">${p.title}</div>
            <div class="vh-prod-price">
              <span class="vh-price">${formatPrice(p.priceMin, p.currency)}</span>
              ${onSale ? `<span class="vh-price-old">${formatPrice(p.compareAtPriceMin, p.currency)}</span>` : ""}
              ${onSale ? `<span class="vh-price-badge">-${savings}%</span>` : ""}
            </div>
            <div class="vh-stock ${p.availableForSale ? "" : "out"}">
              ${p.availableForSale ? "✅ På lager" : "❌ Ikke på lager"}
            </div>
            <div class="vh-prod-cta">
              <a class="vh-prod-link" href="${p.url}" target="_blank" rel="noopener">
                Se produkt →
              </a>
            </div>
          </div>
        </div>`;
    }).join("");
    return `<div class="vh-products">${cards}</div>`;
  }

  // ─── Typing Indicator ──────────────────────────────────────────

  function showTyping() {
    const container = document.getElementById("vh-messages");
    if (!container) return;
    const el = document.createElement("div");
    el.className = "vh-typing";
    el.id = "vh-typing";
    el.innerHTML = `
      <div class="vh-typing-av">${CONFIG.botAvatar}</div>
      <div class="vh-typing-bbl">
        <div class="vh-dot"></div>
        <div class="vh-dot"></div>
        <div class="vh-dot"></div>
      </div>`;
    container.appendChild(el);
    scrollBottom();
  }

  function hideTyping() {
    document.getElementById("vh-typing")?.remove();
  }

  // ─── Lead Form ─────────────────────────────────────────────────

  function showLeadForm() {
    const container = document.getElementById("vh-messages");
    if (!container) return;

    const msgDiv = document.createElement("div");
    msgDiv.className = "vh-msg bot";
    msgDiv.innerHTML = `
      <div class="vh-msg-av">${CONFIG.botAvatar}</div>
      <div class="vh-msg-body" style="max-width:90%">
        <div class="vh-lead" id="vh-lead-form">
          <h4>📋 Efterlad dine kontaktoplysninger</h4>
          <p>Så kontakter en af vores cykeleksperter dig hurtigst muligt.</p>
          <div class="vh-lead-field">
            <input id="vh-lead-name" type="text" placeholder="Dit fulde navn *" required>
          </div>
          <div class="vh-lead-field">
            <input id="vh-lead-email" type="email" placeholder="Din e-mail *" required>
          </div>
          <div class="vh-lead-field">
            <input id="vh-lead-phone" type="tel" placeholder="Telefon (valgfri)">
          </div>
          <div class="vh-lead-field">
            <textarea id="vh-lead-msg" placeholder="Dit spørgsmål eller hvad du søger..." rows="2" style="resize:none;"></textarea>
          </div>
          <div class="vh-lead-check">
            <input type="checkbox" id="vh-lead-consent" required>
            <label for="vh-lead-consent">Jeg accepterer at Velohouse må kontakte mig ang. min forespørgsel.</label>
          </div>
          <button class="vh-lead-submit" id="vh-lead-submit">📨 Send til Velohouse</button>
        </div>
        <div class="vh-msg-time">${timeStr()}</div>
      </div>`;
    container.appendChild(msgDiv);
    scrollBottom();

    document.getElementById("vh-lead-submit").addEventListener("click", submitLead);
  }

  async function submitLead() {
    const name = (document.getElementById("vh-lead-name")?.value || "").trim();
    const email = (document.getElementById("vh-lead-email")?.value || "").trim();
    const phone = (document.getElementById("vh-lead-phone")?.value || "").trim();
    const msg = (document.getElementById("vh-lead-msg")?.value || "").trim();
    const consent = document.getElementById("vh-lead-consent")?.checked;

    if (!name || !email || !consent) {
      alert("Udfyld venligst navn, email og acceptér betingelserne.");
      return;
    }

    const btn = document.getElementById("vh-lead-submit");
    btn.disabled = true;
    btn.textContent = "Sender...";

    try {
      const resp = await fetch(`${API}/api/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone, message: msg, sessionId }),
      });
      const data = await resp.json();

      if (data.success) {
        document.getElementById("vh-lead-form").innerHTML = `
          <div class="vh-lead-success">
            <div class="icon">🎉</div>
            <h4>Tak, ${name.split(" ")[0]}!</h4>
            <p>Vi kontakter dig på <strong>${email}</strong> hurtigst muligt. 🚴</p>
          </div>`;
      } else {
        btn.disabled = false;
        btn.textContent = "📨 Send til Velohouse";
        alert(data.errors?.join("\n") || "Noget gik galt. Prøv igen.");
      }
    } catch {
      btn.disabled = false;
      btn.textContent = "📨 Send til Velohouse";
      alert("Netværksfejl. Prøv igen eller kontakt os direkte på contact@velohouse.dk");
    }
  }

  // ─── Suggestions ───────────────────────────────────────────────

  function renderSuggestions(questions) {
    const container = document.getElementById("vh-suggestions");
    if (!container) return;
    container.innerHTML = "";
    questions.forEach((q) => {
      const btn = document.createElement("button");
      btn.className = "vh-sugg";
      btn.textContent = q;
      btn.addEventListener("click", () => {
        container.innerHTML = "";
        sendSuggestion(q);
      });
      container.appendChild(btn);
    });
  }

  // ─── Send Besked ───────────────────────────────────────────────

  async function sendMessage() {
    const input = document.getElementById("vh-input");
    if (!input) return;
    const text = input.value.trim();
    if (!text || isLoading) return;

    input.value = "";
    input.style.height = "auto";
    document.getElementById("vh-suggestions").innerHTML = "";

    // Gem i historik
    messages.push({ role: "user", content: text });
    addUserMessage(text);

    // Loading state
    isLoading = true;
    document.getElementById("vh-send").disabled = true;
    showTyping();

    try {
      const resp = await fetch(`${API}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId,
          history: messages.slice(-16, -1), // send historik men ikke den aktuelle
        }),
      });

      const data = await resp.json();
      hideTyping();

      if (data.success) {
        messages.push({ role: "assistant", content: data.message });
        addBotMessage(data.message, data.products);

        if (data.suggestLead && messages.length >= 6) {
          setTimeout(showLeadForm, 500);
        }
      } else {
        addBotMessage(data.error || "Noget gik galt. Prøv igen. 🙏");
      }
    } catch (err) {
      hideTyping();
      addBotMessage("⚠️ Kunne ikke oprette forbindelse til serveren. Prøv igen om lidt, eller kontakt os direkte på contact@velohouse.dk");
      console.error("[VH Chatbot]", err);
    } finally {
      isLoading = false;
      document.getElementById("vh-send").disabled = false;
      document.getElementById("vh-input")?.focus();
    }
  }

  function sendSuggestion(text) {
    const input = document.getElementById("vh-input");
    if (input) {
      input.value = text;
      sendMessage();
    }
  }

  // ─── Hjælpere ──────────────────────────────────────────────────

  function scrollBottom() {
    const el = document.getElementById("vh-messages");
    if (el) setTimeout(() => el.scrollTop = el.scrollHeight, 50);
  }

  function showBadge() {
    if (document.getElementById("vh-badge")) return;
    const btn = document.getElementById("vh-btn");
    if (!btn) return;
    const badge = document.createElement("div");
    badge.id = "vh-badge";
    badge.textContent = "1";
    btn.appendChild(badge);
  }

  function clearConversation() {
    messages = [];
    const container = document.getElementById("vh-messages");
    if (container) container.innerHTML = "";
    addBotMessage(CONFIG.welcomeMessage);
    renderSuggestions(CONFIG.suggestedQuestions);
  }

  // ─── Eksponeret API ────────────────────────────────────────────

  window.VHChatbot = {
    open: openChat,
    close: closeChat,
    toggle: toggleChat,
    sendSuggestion,
    clear: clearConversation,
  };

  // ─── Init ──────────────────────────────────────────────────────

  function init() {
    injectStyles();
    buildWidget();

    // Åbn automatisk hvis config siger det
    if (CONFIG.autoOpen) {
      setTimeout(openChat, 1000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
