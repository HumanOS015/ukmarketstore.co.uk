import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useWishlist } from "@/lib/WishlistContext";
import ProductCard from "@/components/ProductCard";
import { Loader2, HeartOff, AlertCircle } from "lucide-react";
import { withTimeout } from "@/lib/withTimeout";
import { Link } from "react-router-dom";

export default function Wishlist() {
  const { user } = useAuth();
  const { wishlistIds, refresh } = useWishlist();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadProducts();
  }, [user, wishlistIds]);

  const loadProducts = async () => {
    if (wishlistIds.size === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const all = await withTimeout(
        base44.entities.Product.filter({ status: "active" }, "-created_date", 500),
        15000,
        "Loading wishlist"
      );
      const ids = new Set(wishlistIds);
      setProducts(all.filter((p) => ids.has(p.id)));
    } catch (err) {
      console.error("Failed to load wishlist products", err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <HeartOff className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="font-medium text-muted-foreground">Sign in to view your saved items</p>
        <Link to="/" className="text-sm text-primary mt-2 inline-block">Browse listings</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:pl-20 py-4 pb-28">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Saved Items</h1>
      <p className="text-sm text-muted-foreground mb-4">{products.length} saved</p>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <HeartOff className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">No saved items yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Tap the heart on any listing to save it here</p>
          <Link
            to="/"
            className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
          >
            Browse listings
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}