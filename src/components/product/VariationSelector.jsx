import { Minus, Plus } from "lucide-react";
import { requiresSize, requiresColour, getVariationStock } from "@/lib/variations";

// Size, colour, and quantity selectors for a product detail page.
// State is owned by the parent so the Add-to-Basket handler can read it.
// Props:
//   product, size, setSize, colour, setColour, quantity, setQuantity
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
  const stock = getVariationStock(product, size, colour);
  const maxQty = Math.max(1, stock);
  const outOfStock = stock <= 0;

  const clampQty = (q) => Math.max(1, Math.min(q, maxQty));

  return (
    <div className="space-y-4">
      {/* Size */}
      {needSize && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">
              Size {size ? <span className="text-muted-foreground font-normal">· {size}</span> : <span className="text-destructive font-normal">*</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`min-w-11 h-11 px-3 rounded-xl border text-sm font-medium transition-all ${
                  size === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-foreground hover:border-primary/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Colour */}
      {needColour && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold">
              Colour {colour ? <span className="text-muted-foreground font-normal">· {colour}</span> : <span className="text-destructive font-normal">*</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {product.colours.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColour(c)}
                className={`h-11 px-4 rounded-xl border text-sm font-medium transition-all ${
                  colour === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border text-foreground hover:border-primary/50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quantity */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Quantity</p>
          <p className="text-xs text-muted-foreground">
            {outOfStock ? "Out of stock" : `${stock} available`}
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