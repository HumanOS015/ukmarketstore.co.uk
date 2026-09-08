import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import ProductCard from "@/components/ProductCard";

export default function SimilarItems({ category, excludeId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await base44.entities.Product.filter(
          { status: "active", category },
          "-created_date",
          12
        );
        if (active) setItems(data.filter((p) => p.id !== excludeId).slice(0, 5));
      } catch (e) {
        // ignore — section simply hides
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [category, excludeId]);

  if (loading || items.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold mb-3">Similar items in {category}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
        {items.map((p) => (
          <div key={p.id} className="w-40 shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}