# 🛍️ Shopify Installation Guide

## Velohouse AI Chatbot – Shopify Opsætning

---

## Forudsætninger

Inden du installerer på Shopify, skal backend-serveren være hostet og tilgængelig via HTTPS.

**Anbefalet hosting:**
- [Railway.app](https://railway.app) (anbefales, nem opsætning)
- [Render.com](https://render.com) (gratis tier tilgængeligt)

---

## Trin 1: Host Backend

### Railway (anbefalet)

```bash
# 1. Installer Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Fra backend-mappen
cd /Users/mihri/Desktop/chatbot/backend
railway up

# 4. Sæt environment variables i Railway dashboard:
#    GEMINI_API_KEY, GMAIL_USER, GMAIL_APP_PASSWORD, EMAIL_TO, osv.
#    Sæt CORS_ORIGINS til: https://velohouse.dk,https://www.velohouse.dk
```

→ Railway giver dig en URL som `https://din-app.railway.app`

---

## Trin 2: Upload chatbot.js til CDN

Enten upload `widget/chatbot.js` til:
- Shopify Files (Admin → Content → Files)
- Din Railway-server som statisk fil
- Cloudflare Pages / Netlify

---

## Trin 3: Indsæt på Shopify

### Metode A: Theme.liquid (anbefalet)

1. Gå til **Shopify Admin → Online Store → Themes**
2. Klik **Actions → Edit code**
3. Under **Layout** → åbn `theme.liquid`
4. Find `</body>` og indsæt DETTE FØR det:

```html
<!-- ============================================ -->
<!-- Velohouse AI Chatbot Widget                   -->
<!-- ============================================ -->
<script>
  window.VelohouseChatConfig = {
    apiUrl: 'https://DIN-BACKEND.railway.app',  // ← Udskift med din backend URL
    primaryColor: '#00b894',
    darkColor: '#1a1a2e',
    botName: 'Velohouse AI Rådgiver',
    botAvatar: '🚴',
    welcomeMessage: 'Hej! 👋 Jeg er din personlige cykelrådgiver hos Velohouse.\n\nJeg kan hjælpe dig med at finde den perfekte cykel, svare på spørgsmål om service, levering og meget mere.\n\nHvad kan jeg hjælpe dig med i dag?',
    suggestedQuestions: [
      'Hvilken elcykel passer til mig?',
      'Hvad er en speed pedelec?',
      'Kan jeg booke testkørsel?',
      'Hvad koster service?',
    ]
  };
</script>
<script src="{{ 'chatbot.js' | asset_url }}" defer></script>
<!-- ============================================ -->
```

5. Upload `chatbot.js` til **Shopify Assets** (Admin → Themes → Assets)
6. Klik **Save**

### Metode B: Via CDN URL

Hvis `chatbot.js` hostes eksternt (f.eks. Railway eller Cloudflare):

```html
<script>
  window.VelohouseChatConfig = {
    apiUrl: 'https://DIN-BACKEND.railway.app',
  };
</script>
<script src="https://DIN-CDN.railway.app/chatbot.js" defer></script>
```

---

## Trin 4: Verificér installation

1. Gå til velohouse.dk i en browser
2. Klik på den grønne chat-knap i hjørnet
3. Skriv: "Hvilken elcykel anbefaler I til pendling?"
4. Chatbotten skal svare på dansk og vise produkter

---

## Opdatering af firmainformation

Rediger `/Users/mihri/Desktop/chatbot/backend/src/data/firmInfo.js` med korrekte:
- Åbningstider
- Adresse og kontaktoplysninger
- Servicepriser
- Leveringsbetingelser

---

## Aktivér rigtige Shopify-produkter

1. Gå til Shopify Admin → **Apps → Develop apps → Create an app**
2. Under API credentials → **Storefront API access scopes**
3. Aktivér: `unauthenticated_read_product_listings`
4. Kopiér **Storefront API access token**
5. Opdatér `.env`:

```env
SHOPIFY_STORE_DOMAIN=velohouse.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=din_token_her
USE_MOCK_PRODUCTS=false
```

6. Genstart backend
