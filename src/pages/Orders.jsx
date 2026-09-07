import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Package, ShoppingBag, ArrowRight, LifeBuoy, AlertCircle, RefreshCw, CheckCircle } from "lucide-react";
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

function OrderCard({ order, onConfirm, confirming }) {
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
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [user, setUser] = useState(null);
  const [confirmingId, setConfirmingId] = useState(null);

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
      await base44.entities.Order.update(orderId, { status: "delivered" });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "delivered" } : o))
      );
      toast.success("Delivery confirmed — the seller has been notified.");
      base44.functions.invoke("orderNotification", { orderId, event: "delivered" }).catch(() => {});
    } catch (err) {
      console.error("Failed to confirm delivery", err);
      toast.error("Couldn't confirm delivery. Please try again.");
    } finally {
      setConfirmingId(null);
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