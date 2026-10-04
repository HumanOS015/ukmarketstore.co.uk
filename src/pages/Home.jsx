import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import ProductCard from "../components/ProductCard";
import SearchBar from "../components/SearchBar";
import ComingSoonBanner from "../components/ComingSoonBanner";
import SellPromoBanner from "../components/mobile/SellPromoBanner";
import { Loader2, PackageOpen, AlertCircle, RefreshCw, Bell, X } from "lucide-react";
import { toast } from "sonner";
import { withTimeout } from "@/lib/withTimeout";
import { Link } from "react-router-dom";

const CATEGORIES = [
"Electronics", "Fashion", "Home & Garden", "Sports", "Toys", "Motors",
"Books", "Music", "Collectibles", "Health & Beauty", "Pet Supplies", "Other"];


export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All Categories");
  const [sortBy, setSortBy] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(20);
  const [user, setUser] = useState(null);
  const [savedSearches, setSavedSearches] = useState([]);
  const [savingSearch, setSavingSearch] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const u = await base44.auth.me().catch(() => null);
        setUser(u);
        if (u?.email) {
          const saved = await base44.entities.SavedSearch.filter({ buyer_email: u.email }, "-created_date", 50);
          setSavedSearches(saved);
        }
      } catch (e) {

        // ignore — saved searches are a secondary feature
      }})();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await withTimeout(
        base44.entities.Product.filter({ status: "active" }, { sort: "-created_date", limit: 100 }),
        15000,
        "Loading listings"
      );
      const data = Array.isArray(res) ? res : res.items || [];
      setProducts(data);
    } catch (err) {
      console.error("Failed to load products", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const feedRef = useRef(null);
  const { pullDistance, refreshing: ptrRefreshing } = usePullToRefresh(feedRef, loadProducts);

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

  const isSearchActive = !!(search.trim() || category !== "All Categories");
  const currentKey = `${search.trim().toLowerCase()}|${category}`;
  const alreadySaved = savedSearches.some(
    (s) => `${(s.query || "").trim().toLowerCase()}|${s.category || "All Categories"}` === currentKey
  );

  const handleSaveSearch = async () => {
    if (!user?.email) {
      toast.info("Log in to save searches and get alerts");
      return;
    }
    setSavingSearch(true);
    try {
      const created = await base44.entities.SavedSearch.create({
        buyer_email: user.email,
        query: search.trim(),
        category
      });
      setSavedSearches((prev) => [created, ...prev]);
      toast.success("Search saved — you'll get a daily email when new items match");
    } catch (e) {
      toast.error("Couldn't save this search");
    } finally {
      setSavingSearch(false);
    }
  };

  const handleDeleteSearch = async (id) => {
    try {
      await base44.entities.SavedSearch.delete(id);
      setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      toast.error("Couldn't remove this search");
    }
  };

  const applySavedSearch = (s) => {
    setSearch(s.query || "");
    setCategory(s.category || "All Categories");
  };

  return (
    <div ref={feedRef} className="max-w-7xl mx-auto px-4 md:pl-20 py-4">
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ height: pullDistance }}>
        
        <Loader2
          className={`w-5 h-5 text-primary ${ptrRefreshing ? "animate-spin" : ""}`}
          style={{
            transform: `rotate(${pullDistance * 3}deg)`,
            opacity: Math.min(pullDistance / 70, 1)
          }} />
        
      </div>

      {/* Hero */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-center gap-4 md:gap-6 mb-6">
        <div className="flex items-center gap-3 md:block">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Discover <span className="text-primary">UK</span> Deals
            </h1>
            <p className="text-muted-foreground mt-1 text-xs">
              Buy & sell across the United Kingdom
            </p>
          </div>
          {/* Mobile-only compact seller promo, to the right of the heading */}
          <SellPromoBanner />
        </div>
        <ComingSoonBanner />
      </div>

      {/* Category chips */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
        {CATEGORIES.map((c) =>
        <Link
          key={c}
          to={`/category/${encodeURIComponent(c)}`}
          className="shrink-0 px-3 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors whitespace-nowrap">
          
            {c}
          </Link>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <SearchBar
          searchValue={search}
          onSearch={setSearch}
          categoryValue={category}
          onCategoryChange={setCategory} />
        
      </div>

      {/* Saved searches */}
      {user?.email && savedSearches.length > 0 &&
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2 mb-4 -mx-4 px-4">
          {savedSearches.map((s) =>
        <div
          key={s.id}
          className="shrink-0 flex items-center gap-1 pl-3 pr-1 py-1.5 rounded-full bg-primary/10 text-xs font-medium text-primary whitespace-nowrap">
          
              <button onClick={() => applySavedSearch(s)} className="hover:underline">
                {s.query || "All"}{s.category && s.category !== "All Categories" ? ` · ${s.category}` : ""}
              </button>
              <button
            onClick={() => handleDeleteSearch(s.id)}
            className="w-4 h-4 flex items-center justify-center rounded-full hover:bg-primary/20">
            
                <X className="w-3 h-3" />
              </button>
            </div>
        )}
        </div>
      }

      {/* Results count + sort */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground">
            {sorted.length} {sorted.length === 1 ? "listing" : "listings"} found
          </p>
          {isSearchActive && user?.email && !alreadySaved &&
          <button
            onClick={handleSaveSearch}
            disabled={savingSearch}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-60">
            
              <Bell className="w-3 h-3" />
              {savingSearch ? "Saving…" : "Save search"}
            </button>
          }
        </div>
        <div className="flex gap-1.5">
          {[
          { key: "newest", label: "Newest" },
          { key: "price-low", label: "£ Low" },
          { key: "price-high", label: "£ High" }].
          map((opt) =>
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            sortBy === opt.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`
            }>
            
              {opt.label}
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ?
      <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div> :
      error ?
      <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="w-10 h-10 text-destructive/60 mb-3" />
          <p className="font-medium text-muted-foreground">Couldn't load listings</p>
          <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
            Your connection may have dropped. Try again.
          </p>
          <button
          onClick={loadProducts}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
          
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div> :
      sorted.length === 0 ?
      <div className="flex flex-col items-center justify-center py-20 text-center">
          <PackageOpen className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">No listings found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Try adjusting your search or filters
          </p>
        </div> :

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {visible.map((product) =>
        <ProductCard key={product.id} product={product} />
        )}
          {visibleCount < sorted.length &&
        <div className="col-span-full flex justify-center mt-4">
              <button
            onClick={() => setVisibleCount((c) => c + 20)}
            className="px-6 py-2.5 rounded-xl bg-muted text-sm font-medium hover:bg-muted/80 transition-colors">
            
                Load More
              </button>
            </div>
        }
        </div>
      }
    </div>);

}