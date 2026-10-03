import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { detectCourier } from "@/lib/courier";
import { withTimeout } from "@/lib/withTimeout";
import moment from "moment";
import { toast } from "sonner";
import {
  Loader2, ArrowLeft, ArrowRight, Truck, CheckCircle, Star, AlertCircle,
  MapPin, CreditCard, ShieldCheck, Package,
} from "lucide-react";

const STEPS = [
  { key: "paid", label: "Order placed", icon: CheckCircle },
  { key: "shipped", label: "Dispatched", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Package },
  { key: "completed", label: "Completed", icon: ShieldCheck },
];

const statusIndex = (status) => {
  const order = ["pending_payment", "paid", "shipped", "delivered", "completed"];
  const i = order.indexOf(status);
  return i < 0 ? 0 : i;
};

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const me = await withTimeout(base44.auth.me(), 15000, "Loading account").catch(() => null);
      setUser(me);
      const ord = await withTimeout(base44.entities.Order.get(id), 15000, "Loading order");
      setOrder(ord);
      if (me?.email && ord.buyer_email === me.email) {
        const revs = await base44.entities.Review.filter({ order_id: id, buyer_email: me.email }, "-created_date", 1).catch(() => []);
        setAlreadyReviewed(revs.length > 0);
      }
    } catch (err) {
      console.error("Failed to load order", err);
      if (err?.status === 401 || err?.status === 403) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const isBuyer = user?.email && order?.buyer_email === user.email;

  const confirmDelivery = async () => {
    setConfirming(true);
    try {
      const res = await withTimeout(base44.functions.invoke("releaseEscrow", { orderId: id }), 30000, "Releasing escrow");
      if (res.data?.ok) {
        setOrder((o) => ({ ...o, status: "completed" }));
        toast.success("Delivery confirmed — the seller has been paid.");
      } else if (res.data?.delivered) {
        setOrder((o) => ({ ...o, status: "delivered" }));
        toast.success("Delivery confirmed — the seller will be paid shortly.");
      } else {
        toast.error(res.data?.reason || "Couldn't complete. Please try again.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.data?.error || "Couldn't confirm delivery. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const submitReview = async () => {
    setSubmittingReview(true);
    try {
      await base44.entities.Review.create({
        order_id: order.id,
        product_id: order.product_id,
        seller_email: order.seller_email,
        buyer_email: user.email,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setAlreadyReviewed(true);
      setReviewOpen(false);
      toast.success("Review submitted!");
    } catch (err) {
      toast.error("Couldn't submit review. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const submitDispute = async () => {
    if (disputeReason.trim().length < 5) {
      toast.error("Please describe the issue (at least 5 characters)");
      return;
    }
    setSubmittingDispute(true);
    try {
      const res = await withTimeout(base44.functions.invoke("openDispute", { orderId: order.id, reason: disputeReason.trim() }), 20000, "Opening dispute");
      if (res.data?.ok) {
        setOrder((o) => ({ ...o, status: "disputed" }));
        setDisputeOpen(false);
        toast.success("Your dispute has been submitted. Our team will review it.");
      } else {
        toast.error(res.data?.error || "Couldn't open a dispute.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.data?.error || "Couldn't open a dispute.");
    } finally {
      setSubmittingDispute(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-10 h-10 text-destructive/60 mx-auto mb-3" />
        <p className="font-medium text-muted-foreground">Couldn't load this order</p>
        <button onClick={load} className="mt-4 inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
          Retry
        </button>
      </div>
    );
  }

  const courier = order.tracking_number ? detectCourier(order.tracking_number) : null;
  const trackingUrl = courier?.trackingUrl || (order.tracking_number ? `https://www.google.com/search?q=${encodeURIComponent("track parcel " + order.tracking_number)}` : null);
  const curIdx = statusIndex(order.status);
  const isRefunded = order.status === "refunded";
  const isDisputed = order.status === "disputed";

  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-4 pb-28">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-xl font-bold tracking-tight mb-1">Order details</h1>
      <p className="text-xs text-muted-foreground mb-5">Placed {moment(order.created_date).format("DD MMM YYYY · HH:mm")}</p>

      {isRefunded && (
        <div className="mb-4 p-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">This order was refunded.</div>
      )}
      {isDisputed && (
        <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-sm text-amber-700 font-medium">This order is under dispute review. Your payment remains held in escrow.</div>
      )}

      {/* Timeline */}
      {!isRefunded && !isDisputed && (
        <div className="rounded-2xl bg-card border border-border p-4 mb-4">
          {STEPS.map((s, i) => {
            const reached = curIdx >= statusIndex(s.key);
            const Icon = s.icon;
            const nextReached = curIdx > statusIndex(s.key);
            return (
              <div key={s.key} className="flex items-start gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${reached ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {i < STEPS.length - 1 && <div className={`w-0.5 h-6 ${nextReached ? "bg-primary" : "bg-muted"}`} />}
                </div>
                <div className="pt-1 pb-6">
                  <p className={`text-sm font-medium ${reached ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
                  {s.key === "shipped" && order.shipped_at && (
                    <p className="text-[11px] text-muted-foreground">{moment(order.shipped_at).format("DD MMM YYYY")}</p>
                  )}
                  {s.key === "delivered" && order.delivered_at && (
                    <p className="text-[11px] text-muted-foreground">{moment(order.delivered_at).format("DD MMM YYYY")}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Product */}
      <Link to={`/product/${order.product_id}`} className="flex gap-3 p-3 rounded-2xl bg-card border border-border hover:shadow-md transition-all mb-4">
        {order.product_image && <img src={order.product_image} alt={order.product_title} className="w-16 h-16 rounded-xl object-cover shrink-0" />}
        <div className="flex-1 min-w-0 self-center">
          <p className="text-sm font-medium truncate">{order.product_title}</p>
          <p className="text-primary font-bold text-sm">£{order.price?.toFixed(2)}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 self-center" />
      </Link>

      {/* Tracking */}
      {order.tracking_number && ["shipped", "delivered", "completed"].includes(order.status) && (
        <div className="rounded-2xl bg-card border border-border p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Truck className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Tracking</p>
            {order.carrier && <Badge variant="secondary" className="text-[10px]">{order.carrier}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground font-mono break-all">{order.tracking_number}</p>
          {trackingUrl && (
            <a href={trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-3 w-full h-11 rounded-xl border border-border text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted transition-colors">
              <Truck className="w-4 h-4" /> {courier ? `Track with ${courier.name}` : "Track parcel"}
            </a>
          )}
        </div>
      )}

      {/* Shipping address */}
      {order.shipping_address && (
        <div className="rounded-2xl bg-card border border-border p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Delivery address</p>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{order.shipping_address}</p>
        </div>
      )}

      {/* Payment summary */}
      <div className="rounded-2xl bg-card border border-border p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <CreditCard className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Payment</p>
        </div>
        <div className="flex justify-between text-sm py-1">
          <span className="text-muted-foreground">Item price</span>
          <span>£{order.price?.toFixed(2)}</span>
        </div>
        {isBuyer ? (
          <div className="flex justify-between text-sm py-1">
            <span className="text-muted-foreground">Status</span>
            <span className="capitalize">{order.status?.replace("_", " ")}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-sm py-1">
              <span className="text-muted-foreground">Commission (10%)</span>
              <span>£{order.commission?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm py-1 font-semibold">
              <span>Your payout</span>
              <span className="text-primary">£{order.seller_payout?.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      {/* Buyer actions */}
      {isBuyer && order.status === "shipped" && (
        <button onClick={confirmDelivery} disabled={confirming} className="w-full h-12 rounded-2xl bg-green-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 mb-3">
          {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Confirm Delivery
        </button>
      )}
      {isBuyer && ["delivered", "completed"].includes(order.status) && !alreadyReviewed && (
        <button onClick={() => { setReviewRating(5); setReviewComment(""); setReviewOpen(true); }} className="w-full h-12 rounded-2xl border border-border text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted transition-colors mb-3">
          <Star className="w-4 h-4" /> Leave a Review
        </button>
      )}
      {isBuyer && ["shipped", "delivered", "completed"].includes(order.status) && (
        <button onClick={() => { setDisputeReason(""); setDisputeOpen(true); }} className="w-full h-12 rounded-2xl border border-amber-200 text-amber-700 text-sm font-medium flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors mb-3">
          <AlertCircle className="w-4 h-4" /> Report a Problem
        </button>
      )}
      {isBuyer && alreadyReviewed && (
        <div className="w-full h-12 rounded-2xl bg-muted text-sm font-medium flex items-center justify-center gap-2 text-muted-foreground mb-3">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> Reviewed
        </div>
      )}

      {/* Review dialog */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave a Review</DialogTitle>
            <DialogDescription>How was your experience with "{order.product_title}"?</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setReviewRating(n)} className="p-1">
                  <Star className={`w-8 h-8 ${n <= reviewRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
            <Textarea placeholder="Share your experience (optional)..." value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} className="rounded-xl min-h-[100px]" />
            <button onClick={submitReview} disabled={submittingReview} className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Review"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dispute dialog */}
      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report a Problem</DialogTitle>
            <DialogDescription>Tell us what went wrong with "{order.product_title}". Your payment stays held in escrow until our team reviews it.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea placeholder="Describe the issue — e.g. item not received, not as described, damaged in transit..." value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} className="rounded-xl min-h-[120px]" />
            <button onClick={submitDispute} disabled={submittingDispute} className="w-full h-11 rounded-xl bg-amber-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
              {submittingDispute ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Dispute"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}