import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ProductCard from "@/components/ProductCard";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Star, Shield, PackageOpen } from "lucide-react";
import { withTimeout } from "@/lib/withTimeout";
import moment from "moment";

export default function SellerStorefront() {
  const { email } = useParams();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [email]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prods, revs] = await Promise.all([
        withTimeout(base44.entities.Product.filter({ seller_email: email, status: "active" }, "-created_date", 100), 15000, "Loading listings"),
        base44.entities.Review.filter({ seller_email: email }, "-created_date", 100).catch(() => []),
      ]);
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

  const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 md:pl-20 py-4 pb-28">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Seller header */}
      <div className="flex items-center gap-3 mb-6 p-4 rounded-2xl border border-border bg-card">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold">Marketplace Seller</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className="gap-1 bg-green-100 text-green-800 border-green-200">
              <Shield className="w-3 h-3" />
              Verified Seller
            </Badge>
            {reviews.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={`w-3.5 h-3.5 ${n <= Math.round(avgRating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {avgRating.toFixed(1)} ({reviews.length})
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Listings */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <PackageOpen className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <p className="font-medium text-muted-foreground">No active listings</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">{products.length} listings</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold mb-3">Seller Reviews</h2>
          <div className="space-y-2">
            {reviews.map((r) => (
              <div key={r.id} className="p-3 rounded-xl border border-border bg-card">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`w-3.5 h-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                      />
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