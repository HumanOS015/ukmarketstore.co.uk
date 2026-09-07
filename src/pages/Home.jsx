import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import ProductCard from "../components/ProductCard";
import SearchBar from "../components/SearchBar";
import { Loader2, PackageOpen, AlertCircle, RefreshCw } from "lucide-react";
import { withTimeout } from "@/lib/withTimeout";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [sortBy, setSortBy] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(20);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await withTimeout(
        base44.entities.Product.filter({ status: "active" }, "-created_date", 100),
        15000,
        "Loading listings"
      );
      setProducts(data);
    } catch (err) {
      console.error("Failed to load products", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter((p) => {
    const matchSearch =
      !search ||
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.postcode?.toLowerCase().includes(search.toLowerCase());
    const matchCategory =
      category === "All Categories" || p.category === category;
    return matchSearch && matchCategory;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "price-low") return a.price - b.price;
    if (sortBy === "price-high") return b.price - a.price;
    return new Date(b.created_date) - new Date(a.created_date);
  });

  const visible = sorted.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(20);
  }, [search, category, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:pl-20 py-4">
      {/* Hero */}
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Discover <span className="text-primary">UK</span> Deals
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Buy & sell across the United Kingdom
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchBar
          searchValue={search}
          onSearch={setSearch}
          categoryValue={category}
          onCategoryChange={setCategory}
        />
      </div>

      {/* Results count + sort */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? "listing" : "listings"} found
        </p>
        <div className="flex gap-1.5">
          {[
            { key: "newest", label: "Newest" },
            { key: "price-low", label: "£ Low" },
            { key: "price-high", label: "£ High" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                sortBy === opt.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-10 h-10 text-destructive/60 mb-3" />
          <p className="font-medium text-muted-foreground">Couldn't load listings</p>
          <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
            Your connection may have dropped. Try again.
          </p>
          <button
            onClick={loadProducts}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PackageOpen className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">No listings found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          {visibleCount < sorted.length && (
            <div className="col-span-full flex justify-center mt-4">
              <button
                onClick={() => setVisibleCount((c) => c + 20)}
                className="px-6 py-2.5 rounded-xl bg-muted text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}