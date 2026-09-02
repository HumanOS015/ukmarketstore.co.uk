import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import ProductCard from "../components/ProductCard";
import SearchBar from "../components/SearchBar";
import { Loader2, PackageOpen } from "lucide-react";
import { toast } from "sonner";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Product.filter(
        { status: "active" },
        "-created_date",
        100
      );
      setProducts(data);
    } catch (err) {
      console.error("Failed to load products", err);
      toast.error("Couldn't load listings. Please try again.");
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

      {/* Results count */}
      <p className="text-xs text-muted-foreground mb-4">
        {filtered.length} {filtered.length === 1 ? "listing" : "listings"} found
      </p>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PackageOpen className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">No listings found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}