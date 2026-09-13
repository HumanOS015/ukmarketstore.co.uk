import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, Truck, ArrowLeft, PlusCircle, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { withTimeout } from "@/lib/withTimeout";
import PayoutConnect from "@/components/PayoutConnect";

const CARRIERS = ["Royal Mail", "Evri"];

const STATUS_COLORS = {
  paid: "bg-yellow-100 text-yellow-700",
  shipped: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  completed: "bg-green-100 text-green-700",
  pending_payment: "bg-slate-100 text-slate-600",
  refunded: "bg-red-100 text-red-700",
  disputed: "bg-orange-100 text-orange-700"
};

export default function SellerDashboard() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [trackingModal, setTrackingModal] = useState(null); // { orderId, productTitle }
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("Royal Mail");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const me = await withTimeout(base44.auth.me(), 15000, "Loading account");
        setUser(me);
        const data = await withTimeout(
          base44.entities.Order.filter({ seller_email: me.email }, "-created_date", 50),
          15000,
          "Loading orders"
        );
        setOrders(data);
      } catch (err) {
        console.error("Failed to load seller dashboard", err);
        if (err?.status === 401 || err?.status === 403) {
          base44.auth.redirectToLogin(window.location.href);
          return;
        }
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const openTracking = (order) => {
    setTrackingNumber(order.tracking_number || "");
    setCarrier("Royal Mail");
    setTrackingModal({ orderId: order.id, productTitle: order.product_title, productId: order.product_id });
  };

  const saveTracking = async () => {
    if (!trackingNumber.trim()) {
      toast.error("Please enter a tracking number");
      return;
    }
    setSaving(true);
    try {
      await withTimeout(
        base44.functions.invoke("markShipped", {
          orderId: trackingModal.orderId,
          trackingNumber: `${carrier}: ${trackingNumber.trim()}`
        }),
        15000,
        "Saving tracking"
      );
      setOrders((prev) =>
      prev.map((o) =>
      o.id === trackingModal.orderId ?
      { ...o, tracking_number: `${carrier}: ${trackingNumber.trim()}`, status: "shipped" } :
      o
      )
      );
      toast.success("Tracking number saved!");
      setTrackingModal(null);
      setTrackingNumber("");
    } catch (err) {
      console.error("Failed to save tracking", err);
      const msg = err?.response?.data?.error || err?.data?.error;
      toast.error(msg || "Couldn't save the tracking number. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-7 h-7 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>);

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
          onClick={() => navigate(0)}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
          
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>);

  }

  const activeOrders = orders.filter((o) => !["refunded", "completed"].includes(o.status));
  const completedOrders = orders.filter((o) => ["completed", "refunded"].includes(o.status));

  const gmv = orders.filter((o) => ["paid", "shipped", "delivered", "completed"].includes(o.status)).reduce((s, o) => s + (o.price || 0), 0);
  const inEscrow = orders.filter((o) => ["paid", "shipped", "delivered"].includes(o.status)).reduce((s, o) => s + (o.price || 0), 0);
  const paidOut = orders.filter((o) => o.status === "completed").reduce((s, o) => s + (o.seller_payout || 0), 0);
  const commissionPaid = orders.filter((o) => o.status === "completed").reduce((s, o) => s + (o.commission || 0), 0);

  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Seller Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your orders and track shipments</p>
        </div>
        <Button className="rounded-xl gap-2" onClick={() => navigate("/sell")}>
          <PlusCircle className="w-4 h-4" /> New Ad
        </Button>
      </div>

      <PayoutConnect user={user} />

      {/* Earnings */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        


        
        


        
        


        
        


        
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
        { label: "Total Orders", value: orders.length },
        { label: "Active Orders", value: activeOrders.length },
        { label: "Completed", value: completedOrders.length }].
        map(({ label, value }) =>
        <div key={label} className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        )}
      </div>

      {/* Active Orders */}
      <h2 className="text-base font-semibold mb-3">Active Orders</h2>
      {activeOrders.length === 0 ?
      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-muted-foreground text-sm mb-8">
          No active orders yet
        </div> :

      <div className="space-y-3 mb-8">
          {activeOrders.map((order) =>
        <OrderCard
          key={order.id}
          order={order}
          onAddTracking={() => openTracking(order)} />

        )}
        </div>
      }

      {/* Completed Orders */}
      {completedOrders.length > 0 &&
      <>
          <h2 className="text-base font-semibold mb-3">Completed Orders</h2>
          <div className="space-y-3">
            {completedOrders.map((order) =>
          <OrderCard key={order.id} order={order} />
          )}
          </div>
        </>
      }

      {/* Tracking Modal */}
      {trackingModal &&
      <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-foreground/30 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Truck className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Add Tracking Number</p>
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">{trackingModal.productTitle}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Carrier</label>
                <div className="flex gap-2">
                  {CARRIERS.map((c) =>
                <button
                  key={c}
                  onClick={() => setCarrier(c)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-all ${
                  carrier === c ?
                  "bg-primary text-primary-foreground border-primary" :
                  "bg-muted border-border text-muted-foreground hover:border-primary/50"}`
                  }>
                  
                      {c}
                    </button>
                )}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tracking Number</label>
                <Input
                placeholder="e.g. TT123456789GB"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="h-11 rounded-xl"
                onKeyDown={(e) => e.key === "Enter" && saveTracking()} />
              
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setTrackingModal(null)}>
                Cancel
              </Button>
              <Button className="flex-1 rounded-xl gap-2" onClick={saveTracking} disabled={saving}>
                <CheckCircle2 className="w-4 h-4" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      }
    </div>);

}

function OrderCard({ order, onAddTracking }) {
  const hasTracking = !!order.tracking_number;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex gap-3 items-start">
      {order.product_image ?
      <img src={order.product_image} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" /> :

      <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <Package className="w-6 h-6 text-muted-foreground/50" />
        </div>
      }
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-sm truncate">{order.product_title}</p>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[order.status] || "bg-muted text-muted-foreground"}`}>
            {order.status.replace("_", " ")}
          </span>
        </div>
        <p className="text-sm font-semibold mt-0.5">£{order.price?.toFixed(2)}</p>
        {hasTracking ?
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Truck className="w-3 h-3" /> {order.tracking_number}
          </p> :

        onAddTracking &&
        <button
          onClick={onAddTracking}
          className="mt-2 text-xs font-medium text-primary hover:underline flex items-center gap-1">
          
              <Truck className="w-3 h-3" /> Add Tracking Number
            </button>

        }
      </div>
    </div>);

}