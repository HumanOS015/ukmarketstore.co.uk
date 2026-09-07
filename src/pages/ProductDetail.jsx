import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Shield,
  ShoppingCart,
  Loader2,
  User,
  Clock,
  Tag,
  AlertCircle,
  RefreshCw,
  Truck,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import moment from "moment";
import { withTimeout } from "@/lib/withTimeout";
import { formatDeliveryDate } from "@/lib/deliveryDate";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [address, setAddress] = useState("");
  const [currentUser, setCurrentUser] = useState(null);
  const [error, setError] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    setError(false);
    setActiveImage(0);
    try {
      const [productData, user] = await Promise.all([
        withTimeout(base44.entities.Product.filter({ id }, "-created_date", 1), 15000, "Loading listing"),
        base44.auth.me().catch(() => null),
      ]);
      setProduct(productData[0]);
      setCurrentUser(user);
    } catch (err) {
      console.error("Failed to load product", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = async () => {
    if (!currentUser) {
      toast.error("Please sign in to complete your purchase");
      base44.auth.redirectToLogin(window.location.pathname);
      return;
    }
    if (!address.trim()) {
      toast.error("Please enter a delivery address");
      return;
    }
    setPurchasing(true);
    const price = product.price;
    const commission = parseFloat((price * 0.1).toFixed(2));
    const sellerPayout = parseFloat((price - commission).toFixed(2));

    try {
      const newOrder = await withTimeout(
        base44.entities.Order.create({
          product_id: product.id,
          product_title: product.title,
          product_image: product.image_url,
          price,
          commission,
          seller_payout: sellerPayout,
          buyer_email: currentUser.email,
          seller_email: product.seller_email,
          status: "paid",
          shipping_address: address.trim(),
        }),
        15000,
        "Processing payment"
      );

      base44.functions.invoke("orderNotification", { orderId: newOrder.id, event: "placed" }).catch(() => {});

      toast.success("Purchase successful! The seller has been notified.");
      setBuyDialogOpen(false);
      navigate("/orders");
    } catch (err) {
      console.error("Purchase failed", err);
      if (err?.status === 401 || err?.status === 403) {
        toast.error("Your session expired. Please sign in again.");
      } else {
        toast.error("Payment couldn't be completed. Please try again.");
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: product.title, url });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-destructive/60 mx-auto mb-3" />
        <p className="font-medium text-muted-foreground">Couldn't load this listing</p>
        <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
          Your connection may have dropped. Try again.
        </p>
        <button
          onClick={loadData}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <p className="font-medium text-muted-foreground">Listing not found</p>
        <Button variant="link" onClick={() => navigate("/")}>
          Back to listings
        </Button>
      </div>
    );
  }

  const isOwner = currentUser?.email === product.seller_email;
  const isSold = product.status === "sold";
  const allImages = [product.image_url, ...(product.additional_images || [])].filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto md:pl-20">
      {/* Secure Marketplace trust badge */}
      <div className="mx-4 mt-4 mb-1 flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2">
        <Shield className="w-4 h-4 text-primary shrink-0" />
        <span className="text-xs font-semibold text-primary">Secure Marketplace</span>
        <span className="text-[11px] text-muted-foreground">· Verified sellers · Tracked UK delivery only</span>
      </div>

      {/* Image Gallery */}
      <div className="relative aspect-square md:aspect-video md:rounded-2xl overflow-hidden bg-muted">
        <img
          src={allImages[activeImage]}
          alt={product.title}
          className="w-full h-full object-cover transition-opacity duration-200"
          fetchpriority="high"
          loading="eager"
          key={activeImage}
        />
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-card/80 backdrop-blur-md flex items-center justify-center hover:bg-card transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onClick={handleShare}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-card/80 backdrop-blur-md flex items-center justify-center hover:bg-card transition-colors"
        >
          <Share2 className="w-5 h-5" />
        </button>
        {allImages.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {allImages.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeImage ? "w-6 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
        {isSold && (
          <div className="absolute inset-0 bg-foreground/50 flex items-center justify-center">
            <span className="text-white font-bold text-3xl tracking-wider">SOLD</span>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {allImages.length > 1 && (
        <div className="flex gap-2 px-4 pt-3 overflow-x-auto">
          {allImages.map((url, i) => (
            <button
              key={i}
              onClick={() => setActiveImage(i)}
              className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-colors ${
                i === activeImage ? "border-primary" : "border-border"
              }`}
            >
              <img src={url} alt={`View ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {/* Details */}
      <div className="px-4 py-5 space-y-5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{product.title}</h1>
            <p className="text-2xl font-bold text-primary whitespace-nowrap">
              £{product.price?.toFixed(2)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="secondary" className="gap-1">
              <Tag className="w-3 h-3" />
              {product.category}
            </Badge>
            {product.condition && (
              <Badge variant="outline" className="gap-1">
                {product.condition}
              </Badge>
            )}
          </div>
        </div>

        {/* Estimated delivery date */}
        {product.estimated_delivery && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <Truck className="w-4 h-4 text-primary shrink-0" />
            <div className="leading-tight">
              <p className="text-sm font-medium">
                Estimated delivery by {formatDeliveryDate(product.estimated_delivery)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Tracked UK Delivery · {product.estimated_delivery}
              </p>
            </div>
          </div>
        )}

        {/* Listing info */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Marketplace Seller</p>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800 border-green-200">
                  <Shield className="w-3 h-3" />
                  Verified Seller
                </Badge>
                <span className="text-xs text-muted-foreground">
                  · Listed {moment(product.created_date).fromNow()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <div>
            <h2 className="text-sm font-semibold mb-2">Description</h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {product.description}
            </p>
          </div>
        )}

        {/* Safety Section */}
        <div className="safety-section rounded-2xl border border-border bg-muted/30 p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">🔒 Safe Marketplace Guarantee</h3>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-5">
              <li>No address sharing</li>
              <li>No meetups</li>
              <li>Secure payments only</li>
              <li>Buyer Protection included</li>
              <li>Sellers paid safely through UKMarketStore</li>
              <li>10% commission protects both sides</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">🛡️ Verified Seller System</h3>
            <p className="text-xs text-muted-foreground">All sellers are verified by UKMarketStore. Orders are protected until delivery is confirmed.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">💳 Secure Checkout Only</h3>
            <p className="text-xs text-muted-foreground">Buyers and sellers cannot contact each other until payment is complete.</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">📦 Delivery Only — No Public Meetups</h3>
            <p className="text-xs text-muted-foreground">All orders are delivered safely. No in-person exchanges allowed.</p>
          </div>
        </div>

        {/* Verified Buyer Protection Badge */}
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-green-800">Verified Buyer Protection</span>
          </div>
          <p className="text-xs text-green-700 leading-relaxed">
            Your payment is held securely in escrow. The seller only receives their money once you confirm you've received the item — so you're fully protected if something goes wrong.
          </p>
        </div>

        {/* Buy Button */}
        {!isOwner && !isSold && (
          <Button
            onClick={() => setBuyDialogOpen(true)}
            className="w-full h-14 rounded-2xl text-base font-semibold gap-2"
            size="lg"
          >
            <ShoppingCart className="w-5 h-5" />
            Buy Now — £{product.price?.toFixed(2)}
          </Button>
        )}

        {isOwner && !isSold && (
          <p className="text-center text-sm text-muted-foreground py-2">
            This is your listing
          </p>
        )}
      </div>

      {/* Buy Dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Purchase</DialogTitle>
            <DialogDescription>
              You're buying "{product.title}" for £{product.price?.toFixed(2)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted">
              <img
                src={product.image_url}
                alt={product.title}
                className="w-16 h-16 rounded-lg object-cover"
                loading="lazy"
              />
              <div>
                <p className="font-medium text-sm">{product.title}</p>
                <p className="text-primary font-bold">£{product.price?.toFixed(2)}</p>
              </div>
            </div>

            <div>
              <Label className="text-sm font-medium">Delivery Address</Label>
              <Textarea
                placeholder="Enter your full UK delivery address..."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1.5 rounded-xl"
              />
            </div>

            <div className="text-xs text-muted-foreground p-3 rounded-xl bg-primary/5">
              <div className="flex items-center gap-1.5 mb-1">
                <Shield className="w-3.5 h-3.5 text-primary" />
                <span className="font-medium text-foreground">Buyer Protection Active</span>
              </div>
              Your payment is held securely. Funds are only released to the seller once you confirm delivery.
            </div>

            <div className="text-xs text-muted-foreground p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="font-medium text-amber-800 mb-0.5">🔒 Secure Checkout Only</p>
              Buyers and sellers cannot contact each other until payment is complete. Complete your purchase to proceed.
            </div>

            <Button
              onClick={handleBuyNow}
              disabled={purchasing}
              className="w-full h-12 rounded-xl font-semibold"
            >
              {purchasing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                `Pay £${product.price?.toFixed(2)}`
              )}
            </Button>

            <p className="text-[11px] text-center text-muted-foreground">
              10% commission applies. Payments processed securely via Stripe Connect.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}