import { useState } from "react";
import { X } from "lucide-react";
import { ResponsiveSelect } from "@/components/ui/responsive-select";
import { SIZE_PRESETS } from "@/lib/variations";

// Seller-facing variation configuration used inside the Create Listing form.
// Reuses the product-level quantity for stock; per-variation stock is supported
// by the data model and read by the buyer side, but edited later from the
// dashboard, to keep the listing form simple.
export default function VariationEditor({ form, update }) {
  const [customSize, setCustomSize] = useState("");
  const [customColour, setCustomColour] = useState("");

  const sizeType = form.size_type || "clothing";
  const sizes = form.sizes || [];
  const colours = form.colours || [];

  const addSize = (s) => {
    const v = s?.trim();
    if (!v || sizes.includes(v)) return;
    update("sizes", [...sizes, v]);
  };
  const removeSize = (s) => update("sizes", sizes.filter((x) => x !== s));

  const addColour = () => {
    const v = customColour.trim();
    if (!v || colours.includes(v)) return;
    update("colours", [...colours, v]);
    setCustomColour("");
  };
  const removeColour = (c) => update("colours", colours.filter((x) => x !== c));

  return (
    <div className="space-y-4 rounded-2xl border border-border p-4">
      <p className="text-sm font-semibold">Variations (optional)</p>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Offer size and colour options. Buyers must select a size or colour before adding to their basket when enabled.
      </p>

      {/* Size toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!form.size_enabled}
          onChange={(e) => update("size_enabled", e.target.checked)}
          className="w-4 h-4 rounded accent-primary"
        />
        <span className="text-sm font-medium">Offer size variations</span>
      </label>

      {form.size_enabled && (
        <div className="space-y-3 pl-6 border-l-2 border-primary/20">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Size type</label>
            <ResponsiveSelect
              value={sizeType}
              onValueChange={(v) => {
                update("size_type", v);
                update("sizes", []);
                setCustomSize("");
              }}
              options={["clothing", "shoe", "custom"]}
              placeholder="Select"
              triggerClassName="rounded-xl"
            />
          </div>

          {sizeType !== "custom" && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Quick add</p>
              <div className="flex flex-wrap gap-1.5">
                {SIZE_PRESETS[sizeType].filter((s) => !sizes.includes(s)).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSize(s)}
                    className="h-8 px-2.5 rounded-lg border border-border text-xs hover:border-primary/50 transition-colors"
                  >
                    + {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={customSize}
              onChange={(e) => setCustomSize(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSize(customSize); setCustomSize(""); } }}
              placeholder={sizeType === "custom" ? "Type any size" : "Add custom size"}
              className="flex-1 h-10 rounded-xl border border-border px-3 text-sm"
            />
            <button
              type="button"
              onClick={() => { addSize(customSize); setCustomSize(""); }}
              className="h-10 px-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Add
            </button>
          </div>

          {sizes.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {sizes.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                  {s}
                  <button type="button" onClick={() => removeSize(s)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Colour toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!form.colour_enabled}
          onChange={(e) => update("colour_enabled", e.target.checked)}
          className="w-4 h-4 rounded accent-primary"
        />
        <span className="text-sm font-medium">Offer colour variations</span>
      </label>

      {form.colour_enabled && (
        <div className="space-y-3 pl-6 border-l-2 border-primary/20">
          <div className="flex gap-2">
            <input
              type="text"
              value={customColour}
              onChange={(e) => setCustomColour(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addColour(); } }}
              placeholder="e.g. Black"
              className="flex-1 h-10 rounded-xl border border-border px-3 text-sm"
            />
            <button
              type="button"
              onClick={addColour}
              className="h-10 px-3 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
            >
              Add
            </button>
          </div>
          {colours.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {colours.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-primary/10 text-primary text-xs font-medium">
                  {c}
                  <button type="button" onClick={() => removeColour(c)} className="hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}