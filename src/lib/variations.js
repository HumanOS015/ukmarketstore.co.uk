// Size presets and variation stock helpers shared across product detail,
// basket, and seller listing forms.

export const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

export const SHOE_SIZES_UK = [
  "UK 0", "UK 0.5", "UK 1", "UK 1.5", "UK 2", "UK 2.5",
  "UK 3", "UK 3.5", "UK 4", "UK 4.5", "UK 5", "UK 5.5",
  "UK 6", "UK 6.5", "UK 7", "UK 7.5", "UK 8", "UK 8.5",
  "UK 9", "UK 9.5", "UK 10", "UK 10.5", "UK 11", "UK 11.5",
  "UK 12", "UK 12.5", "UK 13", "UK 13.5", "UK 14",
];

export const SIZE_PRESETS = {
  clothing: CLOTHING_SIZES,
  shoe: SHOE_SIZES_UK,
  custom: [],
};

// Stock available for a specific size+colour selection.
// Falls back to the product-level available_quantity (then quantity) when no
// per-variation entry matches, so listings without variation_stock keep working.
export function getVariationStock(product, size, colour) {
  if (Array.isArray(product?.variation_stock) && product.variation_stock.length > 0) {
    const match = product.variation_stock.find(
      (v) => (v.size || "") === (size || "") && (v.colour || "") === (colour || "")
    );
    // With per-variation stock configured, a missing combination is unavailable.
    return match ? Math.max(0, Number(match.quantity) || 0) : 0;
  }
  // Older listings only have product-level quantity, so preserve that behaviour.
  if (typeof product?.available_quantity === "number") return Math.max(0, product.available_quantity);
  if (typeof product?.quantity === "number") return Math.max(0, product.quantity);
  return 1;
}

// Whether the buyer must choose a size / colour before adding to basket.
export function requiresSize(product) {
  return !!product?.size_enabled && Array.isArray(product.sizes) && product.sizes.length > 0;
}
export function requiresColour(product) {
  return !!product?.colour_enabled && Array.isArray(product.colours) && product.colours.length > 0;
}

// Stable per-variation key so the same product in different sizes/colours is a
// separate basket line, and the same product+variation merges quantity.
export const variationKey = (productId, size, colour) =>
  `${productId}__${size || ""}__${colour || ""}`;