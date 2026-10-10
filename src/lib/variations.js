// Size presets and variation stock helpers shared across product detail,
// basket, and seller listing forms.

export const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];

export const SHOE_SIZES_UK = [
  "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5.5",
  "6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5",
  "11", "11.5", "12", "12.5", "13",
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
  if (product?.variation_stock?.length) {
    const match = product.variation_stock.find(
      (v) => (v.size || "") === (size || "") && (v.colour || "") === (colour || "")
    );
    if (match) return Number(match.quantity) || 0;
  }
  if (typeof product?.available_quantity === "number") return product.available_quantity;
  if (typeof product?.quantity === "number") return product.quantity;
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