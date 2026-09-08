import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Package, ShoppingBag, ArrowRight, LifeBuoy, AlertCircle, RefreshCw, CheckCircle, Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import moment from "moment";
import { withTimeout } from "@/lib/withTimeout";
import { toast } from "sonner";

const STATUS_COLORS = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  refunded: "bg-red-100 text-red-800",
  disputed: "bg-red-100 text-red-800",
};

function OrderCard({ order, onConfirm, confirming, onReview, reviewed, onDispute }) {
  return (
    <div>
      <Link
        to={`/product/${order.product_id}`}
        className="flex gap-3 p-3 rounded-xl bg-card border border-border hover:shadow-md transition-all"
      >
        {order.product_image && (
          <img
            src={order.product_image}
            alt={order.product_title}
            className="w-16 h-16 rounded-lg object-cover shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{order.product_title}</p>
          <p className="text-primary font-bold text-sm">£{order.price?.toFixed(2)}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] || "bg-muted text-muted-foreground"}`}>
              {order.status?.replace("_", " ")}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {moment(order.created_date).fromNow()}
            </span>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 self-center" />
      </Link>
      {order.status === "shipped" && onConfirm && (
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="w-full mt-2 h-10 rounded-xl bg-green-600 text-white text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Confirm Delivery
        </button>
      )}
      {["delivered", "completed"].includes(order.status) && onReview && !reviewed && (
        <button
          onClick={onReview}
          className="w-full mt-2 h-10 rounded-xl border border-border text-sm font-medium flex items-center justify-center gap-2 hover:bg-muted transition-colors"
        >
          <Star className="w-4 h-4" />
          Leave a Review
        </button>
      )}
      {["shipped", "delivered"].includes(order.status) && onDispute && (
        <button
          onClick={onDispute}
          className="w-full mt-2 h-10 rounded-xl border border-amber-200 text-amber-700 text-sm font-medium flex items-center justify-center gap-2 hover:bg-amber-50 transition-colors"
        >
          <AlertCircle className="w-4 h-4" />
          Report a Problem
        </button>
      )}
      {["delivered", "completed"].includes(order.status) && reviewed && (
        <div className="w-full mt-2 h-10 rounded-xl bg-muted text-sm font-medium flex items-center justify-center gap-2 text-muted-foreground">
          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
          Reviewed
        </div>
      )}
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [user, setUser] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);
  const [reviewOrder, setReviewOrder] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedOrderIds, setReviewedOrderIds] = useState(new Set());
  const [disputeOrder, setDisputeOrder] = useState(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [submittingDispute, setSubmittingDispute] = useState(false);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    setError(false);
    try {
      const me = await withTimeout(base44.auth.me(), 15000, "Loading account");
      setUser(me);
      const allOrders = await withTimeout(
        base44.entities.Order.list("-created_date", 100),
        15000,
        "Loading orders"
      );
      setOrders(allOrders);
      const reviews = await base44.entities.Review.filter({ buyer_email: me.email }, "-created_date", 100).catch(() => []);
      setReviewedOrderIds(new Set(reviews.map((r) => r.order_id)));
    } catch (err) {
      console.error("Failed to load orders", err);
      if (err?.status === 401 || err?.status === 403) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDelivery = async (orderId) => {
    setConfirmingId(orderId);
    try {
      const res = await withTimeout(
        base44.functions.invoke("releaseEscrow", { orderId }),
        30000,
        "Releasing escrow"
      );
      if (res.data?.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: "completed" } : o))
        );
        toast.success("Delivery confirmed — the seller has been paid.");
      } else if (res.data?.delivered) {
        // Buyer confirmed, but the payout is pending (platform balance settling)
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: "delivered" } : o))
        );
        toast.success("Delivery confirmed — the seller will be paid shortly.");
      } else {
        toast.error(res.data?.reason || "Couldn't complete. Please try again.");
      }
    } catch (err) {
      console.error("Failed to confirm delivery", err);
      const msg = err?.response?.data?.error || err?.data?.error;
      toast.error(msg || "Couldn't confirm delivery. Please try again.");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleReview = async () => {
    if (!reviewOrder) return;
    setSubmittingReview(true);
    try {
      await base44.entities.Review.create({
        order_id: reviewOrder.id,
        product_id: reviewOrder.product_id,
        seller_email: reviewOrder.seller_email,
        buyer_email: user.email,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });
      setReviewedOrderIds((prev) => new Set([...prev, reviewOrder.id]));
      toast.success("Review submitted!");
      setReviewOrder(null);
      setReviewComment("");
      setReviewRating(5);
    } catch (err) {
      console.error("Review failed", err);
      toast.error("Couldn't submit review. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDispute = async () => {
    if (!disputeOrder) return;
    if (disputeReason.trim().length < 5) {
      toast.error("Please describe the issue (at least 5 characters)");
      return;
    }
    setSubmittingDispute(true);
    try {
      const res = await withTimeout(
        base44.functions.invoke("openDispute", { orderId: disputeOrder.id, reason: disputeReason.trim() }),
        20000,
        "Opening dispute"
      );
      if (res.data?.ok) {
        setOrders((prev) => prev.map((o) => (o.id === disputeOrder.id ? { ...o, status: "disputed" } : o)));
        toast.success("Your dispute has been submitted. Our team will review it.");
        setDisputeOrder(null);
        setDisputeReason("");
      } else {
        toast.error(res.data?.error || "Couldn't open a dispute.");
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.data?.error;
      toast.error(msg || "Couldn't open a dispute.");
    } finally {
      setSubmittingDispute(false);
    }
  };

  const purchases = orders.filter((o) => o.buyer_email === user?.email);
  const sales = orders.filter((o) => o.seller_email === user?.email);

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
        <p className="font-medium text-muted-foreground">Couldn't load your orders</p>
        <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
          Your connection may have dropped. Try again.
        </p>
        <button
          onClick={loadOrders}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-6">
      <h1 className="text-2xl font-bold tracking-tight mb-1">My Orders</h1>
      <p className="text-sm text-muted-foreground mb-6">Track your purchases and sales</p>

      <Link
        to="/buyer-protection-assistant"
        className="flex items-center justify-between gap-2 mb-6 px-4 py-3 rounded-2xl bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <LifeBuoy className="w-4 h-4 text-green-700" />
          <span className="text-sm font-medium text-green-800">Issue with a completed order?</span>
        </div>
        <ArrowRight className="w-4 h-4 text-green-700" />
      </Link>

      <Tabs defaultValue="purchases">
        <TabsList className="w-full rounded-xl h-11 mb-4">
          <TabsTrigger value="purchases" className="flex-1 gap-1.5 rounded-lg">
            <ShoppingBag className="w-4 h-4" />
            Purchases ({purchases.length})
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex-1 gap-1.5 rounded-lg">
            <Package className="w-4 h-4" />
            Sales ({sales.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="space-y-2">
          {purchases.length === 0 ? (
            <EmptyState text="No purchases yet" sub="Items you buy will appear here" />
          ) : (
            purchases.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onConfirm={() => handleConfirmDelivery(o.id)}
                confirming={confirmingId === o.id}
                onReview={() => { setReviewOrder(o); setReviewRating(5); setReviewComment(""); }}
                reviewed={reviewedOrderIds.has(o.id)}
                onDispute={() => { setDisputeOrder(o); setDisputeReason(""); }}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="sales" className="space-y-2">
          {sales.length === 0 ? (
            <EmptyState text="No sales yet" sub="Items you sell will appear here" />
          ) : (
            sales.map((o) => <OrderCard key={o.id} order={o} />)
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!reviewOrder} onOpenChange={(open) => !open && setReviewOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave a Review</DialogTitle>
            <DialogDescription>
              How was your experience with "{reviewOrder?.product_title}"?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setReviewRating(n)}
                  className="p-1"
                >
                  <Star
                    className={`w-8 h-8 ${n <= reviewRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
                  />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="Share your experience (optional)..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              className="rounded-xl min-h-[100px]"
            />
            <button
              onClick={handleReview}
              disabled={submittingReview}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submittingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Review"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!disputeOrder} onOpenChange={(open) => !open && setDisputeOrder(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report a Problem</DialogTitle>
            <DialogDescription>
              Tell us what went wrong with "{disputeOrder?.product_title}". Your payment stays held in escrow until our team reviews it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Textarea
              placeholder="Describe the issue — e.g. item not received, not as described, damaged in transit..."
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="rounded-xl min-h-[120px]"
            />
            <button
              onClick={handleDispute}
              disabled={submittingDispute}
              className="w-full h-11 rounded-xl bg-amber-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submittingDispute ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Dispute"}
            </button>
            <p className="text-[11px] text-center text-muted-foreground">
              Opening a dispute pauses the seller's payout. False claims may affect your account.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EmptyState({ text, sub }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Package className="w-10 h-10 text-muted-foreground/30 mb-3" />
      <p className="font-medium text-muted-foreground">{text}</p>
      <p className="text-sm text-muted-foreground/70 mt-1">{sub}</p>
    </div>
  );
}