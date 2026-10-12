import { Minus, Plus } from "lucide-react";
import { requiresSize, requiresColour, getVariationStock } from "@/lib/variations";

// Size, colour, and quantity selectors for a product detail page.
// Availability is calculated from the listing's per-variation stock when present.
export default function VariationSelector({
  product,
  size,
  setSize,
  colour,
  setColour,
  quantity,
  setQuantity,
}) {
  const needSize = requiresSize(product);
  const needColour = requiresColour(product);
  const sizes = Array.isArray(product?.sizes) ? product.sizes : [];
  const colours = Array.isArray(product?.colours) ? product.colours : [];
  const hasVariationStock = Array.isArray(product?.variation_stock) && product.variation_stock.length > 0;

  const getSizeStock = (candidateSize) => {
    if (!needColour) return getVariationStock(product, candidateSize, "");
    if (colour) return getVariationStock(product, candidateSize, colour);
    return colours.reduce((max, candidateColour) =>
      Math.max(max, getVariationStock(product, candidateSize, candidateColour)), 0);
  };

  const getColourStock = (candidateColour) => {
    if (!needSize) return getVariationStock(product, "", candidateColour);
    if (size) return getVariationStock(product, size, candidateColour);
    return sizes.reduce((max, candidateSize) =>
      Math.max(max, getVariationStock(product, candidateSize, candidateColour)), 0);
  };

  const stock = getVariationStock(product, size, colour);
  const maxQty = Math.max(1, stock);
  const outOfStock = stock <= 0;
  const clampQty = (q) => Math.max(1, Math.min(q, maxQty));

  const chooseSize = (nextSize) => {
    setSize(nextSize);
    if (colour && getVariationStock(product, nextSize, colour) <= 0) setColour("");
    setQuantity(1);
  };

  const chooseColour = (nextColour) => {
    setColour(nextColour);
    if (size && getVariationStock(product, size, nextColour) <= 0) setSize("");
    setQuantity(1);
  };

  return (
    <div className="space-y-4">
      {needSize && (
        <div>
          <label htmlFor="product-size" className="block text-sm font-semibold mb-2">
            Size {size ? <span className="text-muted-foreground font-normal">· {size}</span> : <span className="text-destructive font-normal">*</span>}
          </label>
          <select
            id="product-size"
            value={size}
            onChange={(e) => chooseSize(e.target.value)}
            className="w-full h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select size</option>
            {sizes.map((s) => {
              const available = getSizeStock(s) > 0;
              return (
                <option key={s} value={s} disabled={!available}>
                  {s}{hasVariationStock && !available ? " — Out of stock" : ""}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {needColour && (
        <div>
          <label htmlFor="product-colour" className="block text-sm font-semibold mb-2">
            Colour {colour ? <span className="text-muted-foreground font-normal">· {colour}</span> : <span className="text-destructive font-normal">*</span>}
          </label>
          <select
            id="product-colour"
            value={colour}
            onChange={(e) => chooseColour(e.target.value)}
            className="w-full h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Select colour</option>
            {colours.map((c) => {
              const available = getColourStock(c) > 0;
              return (
                <option key={c} value={c} disabled={!available}>
                  {c}{hasVariationStock && !available ? " — Out of stock" : ""}
                </option>
              );
            })}
          </select>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Quantity</p>
          <p className="text-xs text-muted-foreground">
            {outOfStock ? "Select an available variation" : `${stock} available`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setQuantity(clampQty(quantity - 1))}
              disabled={quantity <= 1}
              className="w-11 h-11 flex items-center justify-center hover:bg-muted disabled:opacity-40 transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-12 text-center text-sm font-semibold tabular-nums">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity(clampQty(quantity + 1))}
              disabled={outOfStock || quantity >= maxQty}
              className="w-11 h-11 flex items-center justify-center hover:bg-muted disabled:opacity-40 transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}