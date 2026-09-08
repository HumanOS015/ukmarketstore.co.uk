import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import ProductCard from "@/components/ProductCard";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";

export default function RecentlyViewed({ excludeId }) {
  const { ids } = useRecentlyViewed();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const filtered = ids.filter((id) => id !== excludeId);
    if (filtered.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const data = await base44.entities.Product.filter({ status: "active" }, "-created_date", 100);
        if (!active) return;
        const order = new Set(filtered);
        setProducts(data.filter((p) => order.has(p.id)));
      } catch (e) {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [ids, excludeId]);

  if (loading || products.length === 0) return null;

  return (
    <section>
      <h2 className="text-sm font-semibold mb-3">Recently viewed</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
        {products.map((p) => (
          <div key={p.id} className="w-40 shrink-0">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}