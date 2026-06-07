// ============================================
// SHOPIFY STOREFRONT API KLIENT
// ============================================
// Henter produktdata fra Shopify via GraphQL Storefront API.
// Alle API-kald sker fra backend - ingen credentials eksponeres i frontend.

const axios = require("axios");
const NodeCache = require("node-cache");
const mockProducts = require("../data/mockProducts");

// Cache produkter i 15 minutter
const productCache = new NodeCache({ stdTTL: 900, checkperiod: 120 });

const SHOPIFY_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const STOREFRONT_TOKEN = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
const USE_MOCK = process.env.USE_MOCK_PRODUCTS === "true";
const API_VERSION = "2024-10";

// GraphQL-endpoint
const SHOPIFY_API_URL = `https://${SHOPIFY_DOMAIN}/api/${API_VERSION}/graphql.json`;

// Headers til Shopify Storefront API
const shopifyHeaders = {
  "Content-Type": "application/json",
  "X-Shopify-Storefront-Access-Token": STOREFRONT_TOKEN,
};

// ─── GraphQL Queries ─────────────────────────────────────────────

const PRODUCT_FRAGMENT = `
  fragment ProductDetails on Product {
    id
    title
    handle
    description
    productType
    vendor
    tags
    availableForSale
    priceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    compareAtPriceRange {
      minVariantPrice { amount currencyCode }
      maxVariantPrice { amount currencyCode }
    }
    images(first: 1) {
      edges {
        node { url altText }
      }
    }
    variants(first: 10) {
      edges {
        node {
          id
          title
          availableForSale
          quantityAvailable
          price { amount currencyCode }
          compareAtPrice { amount currencyCode }
          selectedOptions { name value }
        }
      }
    }
    collections(first: 5) {
      edges {
        node { handle title }
      }
    }
    metafields(identifiers: [
      { namespace: "custom", key: "motor" },
      { namespace: "custom", key: "battery" },
      { namespace: "custom", key: "range" }
    ]) {
      namespace key value
    }
  }
`;

const SEARCH_QUERY = `
  ${PRODUCT_FRAGMENT}
  query searchProducts($query: String!, $first: Int!) {
    search(query: $query, types: [PRODUCT], first: $first) {
      edges {
        node {
          ...on Product {
            ...ProductDetails
          }
        }
      }
    }
  }
`;

const ALL_PRODUCTS_QUERY = `
  ${PRODUCT_FRAGMENT}
  query getAllProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: BEST_SELLING) {
      pageInfo { hasNextPage endCursor }
      edges {
        node { ...ProductDetails }
      }
    }
  }
`;

// ─── Hjælpefunktioner ─────────────────────────────────────────────

/**
 * Normaliserer Shopify produkt til internt format
 */
function normalizeShopifyProduct(shopifyProduct) {
  const variants = shopifyProduct.variants.edges.map((e) => {
    const options = {};
    e.node.selectedOptions?.forEach((opt) => {
      options[opt.name.toLowerCase()] = opt.value;
    });
    return {
      id: e.node.id,
      title: e.node.title,
      availableForSale: e.node.availableForSale,
      price: parseFloat(e.node.price.amount),
      compareAtPrice: e.node.compareAtPrice
        ? parseFloat(e.node.compareAtPrice.amount)
        : null,
      size: options["størrelse"] || options["size"] || null,
      color: options["farve"] || options["color"] || null,
    };
  });

  const collections = shopifyProduct.collections.edges.map(
    (e) => e.node.handle
  );

  return {
    id: shopifyProduct.id,
    title: shopifyProduct.title,
    handle: shopifyProduct.handle,
    description: shopifyProduct.description,
    productType: shopifyProduct.productType,
    vendor: shopifyProduct.vendor,
    tags: shopifyProduct.tags || [],
    availableForSale: shopifyProduct.availableForSale,
    priceMin: parseFloat(
      shopifyProduct.priceRange.minVariantPrice.amount
    ),
    priceMax: parseFloat(
      shopifyProduct.priceRange.maxVariantPrice.amount
    ),
    compareAtPriceMin: shopifyProduct.compareAtPriceRange?.minVariantPrice
      ? parseFloat(
          shopifyProduct.compareAtPriceRange.minVariantPrice.amount
        )
      : null,
    currency:
      shopifyProduct.priceRange.minVariantPrice.currencyCode || "DKK",
    images: shopifyProduct.images.edges.map((e) => ({
      url: e.node.url,
      altText: e.node.altText,
    })),
    variants,
    collections,
    url: `https://${SHOPIFY_DOMAIN}/products/${shopifyProduct.handle}`,
  };
}

/**
 * Kalder Shopify GraphQL API
 */
async function shopifyQuery(query, variables = {}) {
  if (!SHOPIFY_DOMAIN || !STOREFRONT_TOKEN) {
    throw new Error("Shopify credentials ikke konfigureret i .env");
  }

  const response = await axios.post(
    SHOPIFY_API_URL,
    { query, variables },
    { headers: shopifyHeaders, timeout: 10000 }
  );

  if (response.data.errors) {
    const errMsg = response.data.errors.map((e) => e.message).join(", ");
    throw new Error(`Shopify GraphQL fejl: ${errMsg}`);
  }

  return response.data.data;
}

// ─── Offentlige funktioner ────────────────────────────────────────

/**
 * Søg produkter i Shopify
 * @param {string} searchQuery - Søgetekst
 * @param {object} filters - { maxPrice, productType, availableOnly }
 * @param {number} limit - Antal resultater (default 6)
 */
async function searchProducts(searchQuery, filters = {}, limit = 6) {
  if (USE_MOCK) {
    return searchMockProducts(searchQuery, filters, limit);
  }

  const cacheKey = `search_${searchQuery}_${JSON.stringify(filters)}_${limit}`;
  const cached = productCache.get(cacheKey);
  if (cached) return cached;

  try {
    const data = await shopifyQuery(SEARCH_QUERY, {
      query: searchQuery,
      first: limit,
    });

    let products = data.search.edges.map((e) =>
      normalizeShopifyProduct(e.node)
    );

    // Anvend filtre
    if (filters.maxPrice) {
      products = products.filter((p) => p.priceMin <= filters.maxPrice);
    }
    if (filters.availableOnly) {
      products = products.filter((p) => p.availableForSale);
    }
    if (filters.productType) {
      products = products.filter(
        (p) =>
          p.productType
            ?.toLowerCase()
            .includes(filters.productType.toLowerCase()) ||
          p.tags.some((t) =>
            t.toLowerCase().includes(filters.productType.toLowerCase())
          )
      );
    }

    productCache.set(cacheKey, products);
    return products;
  } catch (error) {
    console.error("[Shopify] Søgning fejlede:", error.message);
    // Fallback til mock hvis Shopify fejler
    return searchMockProducts(searchQuery, filters, limit);
  }
}

/**
 * Hent alle produkter (til embedding/caching)
 */
async function getAllProducts(limit = 100) {
  if (USE_MOCK) {
    return mockProducts;
  }

  const cacheKey = "all_products";
  const cached = productCache.get(cacheKey);
  if (cached) return cached;

  try {
    let allProducts = [];
    let hasNextPage = true;
    let cursor = null;

    while (hasNextPage && allProducts.length < limit) {
      const data = await shopifyQuery(ALL_PRODUCTS_QUERY, {
        first: Math.min(50, limit - allProducts.length),
        after: cursor,
      });

      const products = data.products.edges.map((e) =>
        normalizeShopifyProduct(e.node)
      );
      allProducts = [...allProducts, ...products];

      hasNextPage = data.products.pageInfo.hasNextPage;
      cursor = data.products.pageInfo.endCursor;
    }

    productCache.set(cacheKey, allProducts);
    return allProducts;
  } catch (error) {
    console.error("[Shopify] Hentning af alle produkter fejlede:", error.message);
    return mockProducts;
  }
}

/**
 * Søg i mock-produkter (lokal filtrering)
 */
function searchMockProducts(query, filters = {}, limit = 6) {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter((w) => w.length > 2);

  let results = mockProducts.filter((p) => {
    const searchText = [
      p.title,
      p.description,
      p.productType,
      p.vendor,
      ...(p.tags || []),
      ...(p.collections || []),
    ]
      .join(" ")
      .toLowerCase();

    // Scorer baseret på matchede ord
    const matchScore = words.filter((w) => searchText.includes(w)).length;
    p._score = matchScore;
    return matchScore > 0;
  });

  // Sorter efter relevans
  results.sort((a, b) => b._score - a._score);

  // Anvend filtre
  if (filters.maxPrice) {
    results = results.filter((p) => p.priceMin <= filters.maxPrice);
  }
  if (filters.availableOnly !== false) {
    results = results.filter((p) => p.availableForSale);
  }
  if (filters.productType) {
    const typeQuery = filters.productType.toLowerCase();
    results = results.filter(
      (p) =>
        p.productType?.toLowerCase().includes(typeQuery) ||
        p.tags?.some((t) => t.toLowerCase().includes(typeQuery)) ||
        p.collections?.some((c) => c.toLowerCase().includes(typeQuery))
    );
  }

  // Fjern intern score fra output
  results.forEach((p) => delete p._score);

  return results.slice(0, limit);
}

/**
 * Invalider cache
 */
function invalidateCache() {
  productCache.flushAll();
  console.log("[Shopify] Cache invalideret");
}

module.exports = {
  searchProducts,
  getAllProducts,
  searchMockProducts,
  invalidateCache,
};
