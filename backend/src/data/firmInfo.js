// ============================================
// FIRMAINFORMATION – Velohouse.dk
// ============================================
// Opdater disse oplysninger med korrekte data fra Velohouse

const firmInfo = {
  name: "Velohouse",
  website: "https://velohouse.dk",
  email: "contact@velohouse.dk",

  contact: {
    email: "contact@velohouse.dk",
    phone: "Kontakt os via hjemmesiden eller email",
    address: "Velohouse, Danmark",
    website: "https://velohouse.dk",
    description:
      "Du kan kontakte os via email på contact@velohouse.dk eller besøge vores hjemmeside på velohouse.dk.",
  },

  openingHours: {
    description:
      "Se vores aktuelle åbningstider på velohouse.dk. Vi opdaterer dem løbende, især i forbindelse med helligdage og sæsonændringer.",
    note: "For de seneste åbningstider, se venligst velohouse.dk.",
  },

  delivery: {
    description:
      "Vi leverer til hele Danmark. Leveringstider og priser varierer afhængigt af produkttype og størrelse.",
    free: "Gratis levering kan forekomme på udvalgte produkter – se de aktuelle betingelser på produktsiden.",
    time: "Typisk 2-7 hverdage, afhængigt af produktet.",
    largeItems:
      "Cykler og større varer leveres typisk med specialtransport. Kontakt os for mere information.",
    note: "For præcise leveringsoplysninger, se venligst produktsiden eller kontakt os direkte.",
  },

  returns: {
    description:
      "Vi har en fair returpolitik. Du har som udgangspunkt 14 dages fortrydelsesret ved køb online.",
    conditions:
      "Produktet skal returneres i original stand og emballage. Brugte produkter kan ikke returneres.",
    process:
      "Kontakt os på contact@velohouse.dk for at initiere en returnering.",
    note: "For fulde returregler, se venligst velohouse.dk.",
  },

  warranty: {
    description:
      "Alle vores produkter leveres med lovpligtig reklamationsret. Mange produkter har desuden yderligere garanti fra producenten.",
    bikes: "Cykler og elcykler har typisk 2 års garanti på ramme og motor.",
    battery: "El-cykel batterier har typisk 1-2 års garanti.",
    note: "Garantiperiode varierer pr. produkt og mærke – se produktsiden for detaljer.",
  },

  service: {
    description:
      "Vi tilbyder professionel cykelservice og reparation udført af uddannede cykelmekanikere.",
    types: [
      "Stor service (fuldt eftersyn)",
      "Lille service (grundlæggende eftersyn)",
      "Punktering",
      "Bremse- og gearjustering",
      "Kæde og drev-udskiftning",
      "El-system tjek (elcykler)",
      "Lakering og overfladebehandling",
    ],
    booking:
      "Book service via vores hjemmeside eller kontakt os direkte for at aftale tid.",
    prices:
      "Priser varierer afhængigt af servicetype. Kontakt os for et tilbud.",
    note: "Vi har altid fokus på kvalitet og hurtig service.",
  },

  testRide: {
    available: true,
    description:
      "Ja, vi tilbyder testkørsel på udvalgte modeller! Du er meget velkommen til at prøve cyklen, inden du køber.",
    booking:
      "Book testkørsel via vores hjemmeside eller skriv til contact@velohouse.dk.",
    note: "Testkørsel anbefales særligt til elcykler, speed pedelecs og ladcykler.",
  },

  financing: {
    description:
      "Vi kan muligvis tilbyde finansieringsmuligheder. Kontakt os for aktuelle muligheder.",
    note: "Se velohouse.dk for opdaterede finansieringstilbud.",
  },

  products: {
    categories: [
      "Elcykler",
      "Ladcykler",
      "Speed Pedelecs",
      "Citybikes",
      "Gravel cykler",
      "Mountainbikes",
      "Racercykler",
      "Børnecykler",
      "Tilbehør",
      "Cykelpleje",
      "Beklædning",
    ],
    brands: [
      "Vi fører et bredt udvalg af anerkendte cykelmærker",
      "Kontakt os for info om specifikke mærker",
    ],
    description:
      "Velohouse er din specialforretning for cykler, elcykler, ladcykler, speed pedelecs og alt tilbehør hertil.",
  },

  faq: [
    {
      question: "Hvad er en speed pedelec?",
      answer:
        "En speed pedelec er en elcykel, der kan assistere op til 45 km/t (mod normal elcykels 25 km/t). Den kræver registrering, nummerplader, hjelm og forsikring, da den sidestilles med en knallert i Danmark. Den er ideel til lange pendlingsture.",
    },
    {
      question: "Hvad er forskellen på elcykel og normal cykel?",
      answer:
        "En elcykel har en elektrisk motor, der assisterer din pedaltrækning – du træder stadig selv, men motoren hjælper dig. Normal elcykelassistance går op til 25 km/t. Dette gør det nemmere at komme op ad bakker og tilbagelægge længere distancer.",
    },
    {
      question: "Hvilken størrelse cykel skal jeg vælge?",
      answer:
        "Generelt: Under 160 cm → XS/S (ramme 44-49 cm). 160-170 cm → S/M (ramme 49-52 cm). 170-180 cm → M (ramme 52-56 cm). 180-190 cm → L (ramme 56-58 cm). Over 190 cm → XL (ramme 58-62 cm). Men det afhænger også af cykeltypen og din kropsbygning. Kom forbi til en gratis størrelsesanbefalning!",
    },
    {
      question: "Hvad er en ladcykel?",
      answer:
        "En ladcykel (cargo bike) er en cykel med et stort lastrum – typisk foran eller bagpå – til at transportere børn, dagligvarer eller andet gods. Der findes både el- og ikke-el ladcykler. De er populære til familiebrug som alternativ til bil.",
    },
    {
      question: "Kan jeg pendle på en elcykel?",
      answer:
        "Absolut! Elcykler er ideelle til pendling. En god elcykel klarer typisk 50-100 km på en opladning. Til 15 km hver vej anbefaler vi en elcykel med mindst 400Wh batteri. Speed pedelecs er velegnede til endnu længere ture.",
    },
    {
      question: "Hvad koster en elcykel?",
      answer:
        "Prisen på elcykler varierer fra ca. 8.000-10.000 kr. for indgangsmodeller til 30.000-50.000+ kr. for premium modeller. Prisen afhænger af motor, batteri, mærke og udstyr. Se vores aktuelle sortiment på velohouse.dk.",
    },
    {
      question: "Kan jeg cykle i regn med en elcykel?",
      answer:
        "Ja! Moderne elcykler er designet til at tåle regn og er typisk IPX4 vandresistente. Dog anbefales det ikke at køre i ekstremt kraftig regn eller at lægge cyklen i vand. Batterierne er godt beskyttede mod fugt.",
    },
    {
      question: "Hvad koster service på en cykel?",
      answer:
        "Priserne varierer efter servicetype og omfang. En lille service starter typisk fra 400-600 kr., mens en stor service kan koste 800-1500 kr. Kontakt os for et præcist tilbud baseret på din cykel og behov.",
    },
  ],

  salesTips: {
    bikeSizes: {
      under160: "XS-S (ramme ca. 44-49 cm)",
      "160to170": "S-M (ramme ca. 49-52 cm)",
      "170to180": "M (ramme ca. 52-56 cm)",
      "180to190": "L (ramme ca. 56-58 cm)",
      over190: "XL (ramme ca. 58-62 cm)",
    },
    useCases: {
      commuting:
        "Til pendling anbefaler vi elcykler med stort batteri (400Wh+) og mulighed for bagage. Speed pedelecs er gode til ture over 20 km.",
      family:
        "Til familiebrug med børn er en ladcykel ideel – den kan transportere 1-3 børn plus indkøb.",
      sport:
        "Til sport og motion passer en gravel cykel, mountainbike eller racercykel afhængigt af underlag.",
      hills:
        "Til bakket terræn anbefales en elcykel med kraftig motor (minimum 250W, gerne 350-500W) og godt gear-range.",
      city:
        "Til bykørsel er en let citybike, hybridcykel eller elcykel med integreret bagagebærer ideel.",
      kids: "Til børn er sikkerhed vigtigst – vælg en alderspassende størrelse og god bremseevne.",
    },
  },
};

module.exports = firmInfo;
