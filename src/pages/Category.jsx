import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProductCard from "@/components/ProductCard";
import { Loader2, AlertCircle, PackageOpen, ArrowLeft } from "lucide-react";
import { withTimeout } from "@/lib/withTimeout";

const CATEGORIES = [
  "Electronics", "Fashion", "Home & Garden", "Sports", "Toys", "Motors",
  "Books", "Music", "Collectibles", "Health & Beauty", "Pet Supplies", "Other",
];

export default function Category() {
  const { category } = useParams();
  const decoded = decodeURIComponent(category || "");
  const valid = CATEGORIES.includes(decoded);

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!valid) return;
    document.title = `${decoded} for sale across the UK — UKMarketStore`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        `Buy and sell ${decoded.toLowerCase()} across the UK with tracked delivery and buyer protection. Browse new and used ${decoded.toLowerCase()} on UKMarketStore.`
      );
    }
  }, [decoded, valid]);

  useEffect(() => {
    if (!valid) {
      setLoading(false);
      return;
    }
    load();
  }, [valid, decoded]);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await withTimeout(
        base44.entities.Product.filter({ status: "active", category: decoded }, { sort: "-created_date", limit: 100 }),
        15000,
        "Loading category"
      );
      const data = Array.isArray(res) ? res : (res.items || []);
      setProducts(data);
    } catch (e) {
      console.error("Failed to load category", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (!valid) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-destructive/60 mx-auto mb-3" />
        <p className="font-medium text-muted-foreground">That category doesn't exist</p>
        <Link to="/" className="text-sm text-primary mt-2 inline-block">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:pl-20 py-4 pb-28">
      <Link
        to="/"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> All listings
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{decoded}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Buy and sell {decoded.toLowerCase()} across the UK · Tracked delivery · Buyer protection
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-10 h-10 text-destructive/60 mb-3" />
          <p className="font-medium text-muted-foreground">Couldn't load listings</p>
          <button
            onClick={load}
            className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
          >
            Retry
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PackageOpen className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">No {decoded.toLowerCase()} listed yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Check back soon or list one yourself</p>
          <Link
            to="/sell"
            className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
          >
            Sell in this category
          </Link>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-4">{products.length} {products.length === 1 ? "listing" : "listings"}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}