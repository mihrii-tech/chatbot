# 🚴 Velohouse Chatbot – Opsætningsvejledning

## Hvad er dette?

En komplet AI-salgsassistent til **Velohouse.dk** bygget med:

- **Backend**: Node.js + Express + Google Gemini AI
- **Widget**: Vanilla JavaScript (ingen dependencies)
- **Shopify-integration**: Shopify Storefront API via GraphQL
- **Email**: Gmail SMTP via Nodemailer

---

## 📁 Projektstruktur

```
chatbot/
├── backend/
│   ├── src/
│   │   ├── app.js                  # Express server (port 3001)
│   │   ├── routes/
│   │   │   ├── chat.js             # POST /api/chat
│   │   │   ├── leads.js            # POST /api/leads
│   │   │   └── products.js         # GET /api/products/search
│   │   ├── services/
│   │   │   ├── gemini.js           # Google Gemini AI
│   │   │   ├── rag.js              # RAG pipeline
│   │   │   ├── shopify.js          # Shopify API klient
│   │   │   └── emailService.js     # Gmail SMTP
│   │   ├── middleware/
│   │   │   ├── rateLimiter.js      # Rate limiting
│   │   │   └── validator.js        # Input validering
│   │   └── data/
│   │       ├── firmInfo.js         # Velohouse firmainformation
│   │       └── mockProducts.js     # Test-produkter (bruges uden Shopify)
│   ├── .env                        # Dine API keys (udfyld dette!)
│   ├── .env.example                # Template
│   └── package.json
└── widget/
    ├── chatbot.js                  # Komplet widget-script
    ├── test.html                   # Test-side
    └── shopify-install.md          # Shopify installationsvejledning
```

---

## 🚀 Hurtig Start (Test)

### 1. Udfyld .env

```bash
# Åbn /Users/mihri/Desktop/chatbot/backend/.env
# Og udfyld:
GEMINI_API_KEY=din_gemini_nøgle
```

> **Vigtigt om Gemini API nøgle**: API-nøglen fra Google AI Studio har gratis daglige kvotegrænser. Hvis du rammer kvoten, vent til næste dag eller opret en betalt konto på https://ai.google.dev/

### 2. Start backend

```bash
cd /Users/mihri/Desktop/chatbot/backend
npm run dev    # Med auto-reload (anbefalet)
# ELLER
npm start      # Uden auto-reload
```

Serveren starter på http://localhost:3001

### 3. Test widget

Åbn `/Users/mihri/Desktop/chatbot/widget/test.html` i din browser.  
(Brug Live Server i VS Code, eller dobbeltklik på filen)

---

## ⚙️ Konfiguration (.env)

```env
# Google Gemini AI (PÅKRÆVET)
GEMINI_API_KEY=din_nøgle_her

# Shopify (kun nødvendig for rigtige produkter)
SHOPIFY_STORE_DOMAIN=velohouse.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=din_token
USE_MOCK_PRODUCTS=true    # Sæt til false for rigtige Shopify-data

# Gmail SMTP (til at sende leads)
GMAIL_USER=din@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   # App password – IKKE normalt password!

# Email destination
EMAIL_TO=contact@velohouse.dk
EMAIL_FROM=Velohouse Chatbot <din@gmail.com>
```

### Opret Gmail App Password

1. Gå til [Google Account](https://myaccount.google.com/)
2. **Security** → **2-Step Verification** (skal være aktiveret)
3. Scroll ned til **App passwords**
4. Vælg "Mail" + "Other (custom name)" → skriv "Velohouse Chatbot"
5. Kopiér det 16-tegn password ind i `.env`

### Opret Shopify Storefront Token

1. Gå til Shopify Admin → **Apps** → **Develop apps**
2. Opret en ny app eller vælg eksisterende
3. Under **API credentials** → **Storefront API access tokens**
4. Tilføj scope: `unauthenticated_read_product_listings`
5. Kopiér token til `.env`

---

## 🧪 Test API Endpoints

```bash
# Health check
curl http://localhost:3001/api/health

# Chat test
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hvilken elcykel anbefaler I til pendling?"}]}'

# Produkt søgning
curl "http://localhost:3001/api/products/search?q=elcykel&maxPrice=25000"

# Lead test
curl -X POST http://localhost:3001/api/leads \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Person","email":"test@test.dk","interest":"Elcykel","gdprConsent":"true"}'
```

---

## 🚀 API Reference

### POST /api/chat

**Request:**
```json
{
  "messages": [
    {"role": "user", "content": "Hvilken elcykel anbefaler I?"},
    {"role": "assistant", "content": "..."},
    {"role": "user", "content": "Hvad koster den?"}
  ],
  "sessionId": "valgfrit-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "message": "AI's svar på dansk...",
  "products": [
    {
      "id": "mock_001",
      "title": "Cube Kathmandu Hybrid Pro 625",
      "priceMin": 24995,
      "images": [{"url": "...", "altText": "..."}],
      "url": "https://velohouse.dk/products/...",
      "availableForSale": true
    }
  ],
  "suggestLead": false,
  "responseTime": 1234
}
```

### POST /api/leads

**Request:**
```json
{
  "name": "Kundens navn",
  "phone": "12345678",
  "email": "kunde@email.dk",
  "interest": "Elcykel til pendling",
  "budget": 25000,
  "bikeType": "elcykel",
  "testDrive": true,
  "gdprConsent": "true",
  "conversation": [...]
}
```

### GET /api/products/search

**Query parametre:**
- `q` – Søgetekst
- `maxPrice` – Maksimum pris i DKK
- `productType` – Produkttype (elcykel, ladcykel, etc.)
- `availableOnly` – true/false
- `limit` – Antal resultater (max 12)

---

## 🛍️ Shopify Installation

### Mulighed 1: Tilføj til theme.liquid

1. Gå til Shopify Admin → **Online Store** → **Themes**
2. Klik **Actions** → **Edit code**
3. Find `theme.liquid` under Layout
4. Indsæt FØR `</body>`:

```html
<!-- Velohouse Chatbot -->
<script>
  window.VelohouseChatConfig = {
    apiUrl: 'https://DIN-BACKEND-URL.com',
    primaryColor: '#00b894',
    botName: 'Velohouse AI Rådgiver',
  };
</script>
<script src="https://DIN-CDN-URL/chatbot.js" defer></script>
```

### Mulighed 2: Shopify Script Tags (via Admin API)

```bash
curl -X POST "https://velohouse.myshopify.com/admin/api/2024-10/script_tags.json" \
  -H "X-Shopify-Access-Token: ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"script_tag":{"event":"onload","src":"https://DIN-CDN-URL/chatbot.js"}}'
```

---

## 🏠 Hosting Backend

Anbefalet gratis/billig hosting:

| Platform | Pris | Link |
|---|---|---|
| **Railway** | Fra $5/måned | railway.app |
| **Render** | Gratis (med dvalefunktion) | render.com |
| **Fly.io** | Gratis tier | fly.io |
| **Digital Ocean** | $6/måned | digitalocean.com |

### Deploy til Railway

```bash
# 1. Installer Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Deploy fra backend-mappen
cd backend
railway up

# 4. Sæt environment variables i Railway dashboard
```

---

## 🔒 Sikkerhed

- ✅ Ingen API keys i frontend
- ✅ Rate limiting (20 req/min på chat, 5 req/10min på leads)
- ✅ Input validering med express-validator
- ✅ Helmet.js sikkerhedsheaders
- ✅ CORS whitelist
- ✅ GDPR-samtykke krævet for leads
- ✅ Ingen persondata i logs

---

## 🐛 Fejlfinding

### "AI-tjenesten er midlertidigt overbelastet"
→ Gemini API gratis-tier kvote er opbrugt. Vent til næste dag eller opgradér til betalt plan.

### "CORS ikke tilladt"
→ Tilføj din Shopify-domain til `CORS_ORIGINS` i `.env`

### "Kunne ikke sende email"
→ Tjek at `GMAIL_APP_PASSWORD` er et App Password (ikke normalt Gmail password). Se [guide ovenfor](#opret-gmail-app-password).

### Produkter vises ikke
→ Kontrollér `USE_MOCK_PRODUCTS=true` i `.env`. For rigtige Shopify-data: udfyld `SHOPIFY_STOREFRONT_ACCESS_TOKEN`.

---

## 📞 Support

Kontakt: contact@velohouse.dk  
Chatbot: velohouse.dk
