import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProductCard from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Star, Shield, PackageOpen, Store } from "lucide-react";
import { withTimeout } from "@/lib/withTimeout";
import moment from "moment";

export default function SellerStorefront() {
  const { email } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [email]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, revRes] = await Promise.all([
        withTimeout(base44.entities.Product.filter({ seller_email: email, status: "active" }, { sort: "-created_date", limit: 100 }), 15000, "Loading listings"),
        base44.entities.Review.filter({ seller_email: email }, { sort: "-created_date", limit: 100 }).catch(() => []),
      ]);
      const prods = Array.isArray(prodRes) ? prodRes : (prodRes.items || []);
      const revs = Array.isArray(revRes) ? revRes : (revRes.items || []);
      setProducts(prods);
      setReviews(revs);
    } catch (err) {
      console.error("Failed to load storefront", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const sellerName = products[0]?.seller_name || "Marketplace Seller";
  const initial = (sellerName || "?").trim().charAt(0).toUpperCase();
  const avgRating = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const memberSince = products.reduce((min, p) => {
    const d = new Date(p.created_date);
    return min ? (d < min ? d : min) : d;
  }, null);

  return (
    <div className="max-w-5xl mx-auto px-4 md:pl-20 py-4 pb-28">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Store header */}
      <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/5 to-transparent p-5 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{sellerName}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <Badge className="gap-1 bg-green-100 text-green-800 border-green-200">
                <Shield className="w-3 h-3" /> Verified Seller
              </Badge>
              {reviews.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-3.5 h-3.5 ${n <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{avgRating.toFixed(1)} ({reviews.length})</span>
                </div>
              )}
            </div>
            {memberSince && (
              <p className="text-[11px] text-muted-foreground mt-2">Selling since {moment(memberSince).format("MMM YYYY")}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5">
          <Stat label="Listings" value={products.length} />
          <Stat label="Reviews" value={reviews.length} />
          <Stat label="Rating" value={reviews.length ? avgRating.toFixed(1) : "—"} />
        </div>
      </div>

      {/* Listings */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Store className="w-4 h-4 text-primary" /> Store listings
        </h2>
        {products.length > 0 && <span className="text-xs text-muted-foreground">{products.length} items</span>}
      </div>

      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PackageOpen className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">No active listings</p>
          <p className="text-sm text-muted-foreground/70 mt-1">This seller has nothing for sale right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold mb-3">Seller reviews</h2>
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={r.id} className="p-3 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{moment(r.created_date).format("DD MMM YYYY")}</span>
                </div>
                {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-card border border-border px-3 py-2.5 text-center">
      <p className="text-lg font-bold text-primary leading-none">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}