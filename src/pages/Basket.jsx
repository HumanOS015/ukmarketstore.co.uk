import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/lib/CartContext";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { ArrowLeft, Minus, Plus, Trash2, ShoppingCart, Loader2, Shield, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { withTimeout } from "@/lib/withTimeout";

export default function Basket() {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, total, clear } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [address, setAddress] = useState({
    fullName: "", phone: "", streetLine1: "", streetLine2: "", city: "", state: "", postcode: "",
  });

  const handleCheckout = async () => {
    if (window.self !== window.top) {
      const publishedUrl = "https://ukmarketstore.base44.app/basket";
      window.open(publishedUrl, "_blank");
      toast.info("Opening the live app in a new tab — checkout works there, not in the preview.");
      return;
    }
    for (const f of ["fullName", "phone", "streetLine1", "city", "postcode"]) {
      if (!address[f].trim()) {
        toast.error(`Please enter your ${f === "fullName" ? "full name" : f === "streetLine1" ? "street address" : f}`);
        return;
      }
    }
    const shippingAddress = [
      address.fullName, address.streetLine1, address.streetLine2 || null,
      address.city, address.state || "", address.postcode,
    ].filter(Boolean).join(", ");

    setPurchasing(true);
    try {
      const res = await withTimeout(
        base44.functions.invoke("createBasketCheckout", {
          items: items.map((i) => ({
            productId: i.productId, size: i.size || null, colour: i.colour || null, quantity: i.quantity,
          })),
          shippingAddress,
        }),
        25000,
        "Preparing checkout"
      );
      if (res.data?.checkoutUrl) {
        clear();
        window.location.href = res.data.checkoutUrl;
      } else {
        toast.error(res.data?.error || "Couldn't start checkout. Please try again.");
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.data?.error;
      if (err?.response?.status === 401 || err?.status === 401) {
        toast.error("Please sign in to continue to checkout");
        setCheckoutOpen(false);
        base44.auth.redirectToLogin(window.location.href);
      } else {
        toast.error(msg || "Couldn't start checkout. Please try again.");
      }
    } finally {
      setPurchasing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 md:pl-20 py-6">
        <h1 className="text-2xl font-bold tracking-tight mb-6">Your Basket</h1>
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <ShoppingCart className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium text-muted-foreground">Your basket is empty</p>
          <p className="text-sm text-muted-foreground/70 mt-1 mb-5">Browse listings and add items to get started.</p>
          <Button onClick={() => navigate("/")} className="rounded-xl">Browse listings</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-6 pb-28">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Continue shopping
      </button>

      <h1 className="text-2xl font-bold tracking-tight mb-4">Your Basket</h1>

      <div className="space-y-3 mb-6">
        {items.map((item) => (
          <div key={item.key} className="rounded-2xl border border-border bg-card p-3 flex gap-3">
            <Link to={`/product/${item.productId}`} className="shrink-0">
              <img src={item.image} alt={item.title} className="w-20 h-20 rounded-xl object-cover" />
            </Link>
            <div className="flex-1 min-w-0">
              <Link to={`/product/${item.productId}`} className="text-sm font-medium hover:underline line-clamp-2">
                {item.title}
              </Link>
              {(item.size || item.colour) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[item.size, item.colour].filter(Boolean).join(" · ")}
                </p>
              )}
              <p className="text-primary font-bold text-sm mt-1">£{Number(item.price).toFixed(2)}</p>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => updateQuantity(item.key, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="w-8 h-8 flex items-center justify-center hover:bg-muted disabled:opacity-40"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-9 text-center text-sm font-semibold tabular-nums">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.key, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center hover:bg-muted"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <button
                  onClick={() => removeItem(item.key)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-semibold">£{(Number(item.price) * item.quantity).toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-4">
        <div className="flex justify-between items-center text-base font-bold">
          <span>Total</span>
          <span>£{total.toFixed(2)}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          10% commission included per item. Payments processed securely via Stripe Connect.
        </p>
      </div>

      <Button onClick={() => setCheckoutOpen(true)} className="w-full h-14 rounded-2xl text-base font-semibold gap-2">
        <ShoppingCart className="w-5 h-5" /> Continue to Checkout — £{total.toFixed(2)}
      </Button>

      {/* Checkout address dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirm your order</DialogTitle>
            <DialogDescription>
              {items.length} item{items.length > 1 ? "s" : ""} · £{total.toFixed(2)} total
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-4">
            <div className="col-span-2 p-3 rounded-xl bg-muted text-sm space-y-1 max-h-40 overflow-y-auto">
              {items.map((i) => (
                <div key={i.key} className="flex justify-between text-xs">
                  <span className="truncate pr-2">{i.title}{i.size ? ` · ${i.size}` : ""}{i.colour ? ` · ${i.colour}` : ""} ×{i.quantity}</span>
                  <span className="shrink-0">£{(Number(i.price) * i.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Full Name</Label>
              <Input value={address.fullName} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Phone Number</Label>
              <Input value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Street Address</Label>
              <Input value={address.streetLine1} onChange={(e) => setAddress({ ...address, streetLine1: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Apt, suite, etc. (optional)</Label>
              <Input value={address.streetLine2} onChange={(e) => setAddress({ ...address, streetLine2: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div className="col-span-1">
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">City</Label>
              <Input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div className="col-span-1">
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">State/Region</Label>
              <Input value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} className="h-11 rounded-xl" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Postcode</Label>
              <Input value={address.postcode} onChange={(e) => setAddress({ ...address, postcode: e.target.value })} className="h-11 rounded-xl uppercase" />
            </div>
            <div className="col-span-2 text-xs text-muted-foreground p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-1.5 mb-1">
                <Shield className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <span className="font-medium text-foreground">Buyer Protection Active</span>
              </div>
              Your payment is held securely in escrow. Funds are released to each seller only once you confirm delivery.
            </div>
          </div>
          <div className="flex gap-2 pt-4 border-t border-border">
            <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setCheckoutOpen(false)}>Cancel</Button>
            <Button className="flex-1 rounded-xl h-11 font-semibold gap-2" onClick={handleCheckout} disabled={purchasing}>
              {purchasing ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Pay £{total.toFixed(2)} <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}