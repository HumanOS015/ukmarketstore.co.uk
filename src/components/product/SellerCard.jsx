import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle, Shield, Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";

export default function SellerCard({ product, currentUser, onMessage, messaging }) {
  const isOwner = currentUser?.email === product?.seller_email;
  const sellerName = product?.seller_name || "Marketplace Seller";
  const [rating, setRating] = useState(null); // { avg, count } | null while loading

  useEffect(() => {
    if (!product?.seller_email) return;
    let active = true;
    (async () => {
      try {
        const res = await base44.entities.Review.aggregate({
          query: { seller_email: product.seller_email },
          avg: "rating",
        });
        const row = res?.rows?.[0];
        if (active) {
          setRating({
            avg: row?.avg_rating ? Math.round(row.avg_rating * 10) / 10 : 0,
            count: row?.count || 0,
          });
        }
      } catch {
        if (active) setRating({ avg: 0, count: 0 });
      }
    })();
    return () => { active = false; };
  }, [product?.seller_email]);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground mb-1">About the seller</p>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              to={`/seller/${product?.seller_email}`}
              className="font-semibold truncate hover:text-primary transition-colors"
            >
              {sellerName}
            </Link>
            <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 border-green-200">
              <Shield className="w-3 h-3" />
              Verified seller
            </Badge>
          </div>

          {/* Seller rating */}
          {rating && rating.count > 0 ? (
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`w-3.5 h-3.5 ${n <= Math.round(rating.avg) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">
                {rating.avg.toFixed(1)} ({rating.count} {rating.count === 1 ? "review" : "reviews"})
              </span>
            </div>
          ) : rating && rating.count === 0 ? (
            <p className="text-xs text-muted-foreground mt-1.5">No reviews yet</p>
          ) : null}

          <p className="text-xs text-muted-foreground mt-1">
            Questions about this item? Message the seller directly through UKMarketStore.
          </p>
        </div>
      </div>

      {!isOwner && (
        <Button
          type="button"
          onClick={onMessage}
          disabled={messaging}
          variant="outline"
          className="w-full mt-4 h-11 rounded-xl gap-2"
        >
          {messaging ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
          {messaging ? "Opening messages…" : "Message seller"}
        </Button>
      )}
    </div>
  );
}