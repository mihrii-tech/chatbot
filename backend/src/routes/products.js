// ============================================
// PRODUCTS ROUTE – GET /api/products/search
// ============================================

const express = require("express");
const router = express.Router();
const { searchProducts } = require("../services/shopify");
const { productLimiter } = require("../middleware/rateLimiter");

/**
 * GET /api/products/search
 * Query: ?q=elcykel&maxPrice=20000&productType=elcykel&availableOnly=true&limit=6
 * Response: { success, products, count }
 */
router.get("/search", productLimiter, async (req, res) => {
  try {
    const {
      q = "",
      maxPrice,
      productType,
      availableOnly = "true",
      limit = "6",
    } = req.query;

    // Validér input
    const limitNum = Math.min(parseInt(limit) || 6, 12);
    const maxPriceNum = maxPrice ? parseFloat(maxPrice) : null;

    const filters = {
      maxPrice: maxPriceNum,
      productType: productType || null,
      availableOnly: availableOnly !== "false",
    };

    const products = await searchProducts(q, filters, limitNum);

    // Fjern interne felter fra response
    const sanitizedProducts = products.map((p) => ({
      id: p.id,
      title: p.title,
      handle: p.handle,
      description: p.description?.slice(0, 300),
      productType: p.productType,
      vendor: p.vendor,
      tags: p.tags,
      availableForSale: p.availableForSale,
      priceMin: p.priceMin,
      priceMax: p.priceMax,
      compareAtPriceMin: p.compareAtPriceMin,
      currency: p.currency || "DKK",
      images: p.images?.slice(0, 1),
      variants: p.variants?.filter((v) => v.availableForSale).slice(0, 5),
      url: p.url,
    }));

    return res.json({
      success: true,
      products: sanitizedProducts,
      count: sanitizedProducts.length,
    });
  } catch (error) {
    console.error("[Products] Søgning fejlede:", error.message);
    return res.status(500).json({
      success: false,
      error: "Produktsøgning fejlede",
      products: [],
    });
  }
});

module.exports = router;
