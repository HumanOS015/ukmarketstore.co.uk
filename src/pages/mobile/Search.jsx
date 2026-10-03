import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import ProductCard from "@/components/ProductCard";
import { Loader2, AlertCircle, RefreshCw, Search as SearchIcon, X } from "lucide-react";

const CATEGORIES = [
  "All Categories", "Electronics", "Fashion", "Home & Garden", "Sports", "Toys", "Motors",
  "Books", "Music", "Collectibles", "Health & Beauty", "Pet Supplies", "Other",
];

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "price-low", label: "£ Low" },
  { key: "price-high", label: "£ High" },
];

export default function Search() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [sortBy, setSortBy] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(20);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await base44.entities.Product.filter({ status: "active" }, "-created_date", 100);
      setProducts(data);
    } catch (e) {
      console.error("Search load failed", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setVisibleCount(20);
  }, [search, category, sortBy]);

  const filtered = products.filter((p) => {
    const matchSearch =
      !search ||
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "All Categories" || p.category === category;
    return matchSearch && matchCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "price-low") return a.price - b.price;
    if (sortBy === "price-high") return b.price - a.price;
    return new Date(b.created_date) - new Date(a.created_date);
  });

  const visible = sorted.slice(0, visibleCount);

  return (
    <div className="px-4 pt-4 pb-6">
      <h1 className="text-xl font-bold tracking-tight mb-3">Search</h1>

      <div className="relative mb-3">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search UKMarketStore"
          className="w-full h-11 pl-10 pr-10 rounded-xl bg-card border border-border text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-label="Clear"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              category === c
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3 gap-2">
        <p className="text-xs text-muted-foreground">{sorted.length} results</p>
        <div className="flex gap-1.5">
          {SORTS.map((o) => (
            <button
              key={o.key}
              onClick={() => setSortBy(o.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                sortBy === o.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-16 text-center">
          <AlertCircle className="w-10 h-10 text-destructive/60 mb-3" />
          <p className="font-medium text-muted-foreground mb-3">Couldn't load listings</p>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <SearchIcon className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">No results</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Try a different search or category
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {visible.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          {visibleCount < sorted.length && (
            <div className="flex justify-center mt-4">
              <button
                onClick={() => setVisibleCount((c) => c + 20)}
                className="px-6 py-2.5 rounded-xl bg-muted text-sm font-medium"
              >
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}