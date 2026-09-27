import { MessageCircle, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function SellerCard({ product, currentUser, onMessage, messaging }) {
  const isOwner = currentUser?.email === product?.seller_email;
  const sellerName = product?.seller_name || "Marketplace Seller";

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Shield className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground mb-1">About the seller</p>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-semibold truncate">{sellerName}</h2>
            <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 border-green-200">
              <Shield className="w-3 h-3" />
              Verified seller
            </Badge>
          </div>
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
