import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Ban, CheckCircle, Shield, Users, Package, ShoppingBag, RotateCcw, BarChart3, Bell } from "lucide-react";
import { toast } from "sonner";
import moment from "moment";
import AnalyticsTab from "@/components/admin/AnalyticsTab";
import InventoryMonitor from "@/components/admin/InventoryMonitor";
import { ShieldCheck } from "lucide-react";

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("listings");
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refundingId, setRefundingId] = useState(null);

  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/");
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === "admin") {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allProducts, allUsers, allOrders, allSubs] = await Promise.all([
        base44.entities.Product.list("-created_date", 500),
        base44.entities.User.list("-created_date", 500),
        base44.entities.Order.list("-created_date", 500),
        base44.entities.LaunchSubscriber.list("-created_date", 500),
      ]);
      setProducts(allProducts);
      setUsers(allUsers);
      setOrders(allOrders);
      setSubscribers(allSubs);
    } catch (err) {
      console.error("Admin load failed", err);
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveListing = async (productId) => {
    try {
      await base44.entities.Product.update(productId, { status: "removed" });
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, status: "removed" } : p))
      );
      toast.success("Listing removed");
    } catch (err) {
      toast.error("Failed to remove listing");
    }
  };

  const handleRefund = async (orderId) => {
    if (!window.confirm("Issue a full refund to the buyer? This cannot be undone.")) return;
    setRefundingId(orderId);
    try {
      const res = await base44.functions.invoke("refundOrder", { orderId });
      if (res.data?.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: "refunded" } : o))
        );
        toast.success("Refund issued — buyer has been notified.");
      } else {
        toast.error(res.data?.error || "Refund failed.");
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.data?.error;
      toast.error(msg || "Refund failed.");
    } finally {
      setRefundingId(null);
    }
  };

  const handleToggleBan = async (userId, currentBanned) => {
    try {
      await base44.entities.User.update(userId, { banned: !currentBanned });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, banned: !currentBanned } : u))
      );
      toast.success(currentBanned ? "User unbanned" : "User banned");
    } catch (err) {
      toast.error("Failed to update user");
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const statusVariant = (status) =>
    status === "active" ? "default" : status === "sold" ? "secondary" : "destructive";

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Admin Panel</h1>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("listings")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === "listings" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Package className="w-4 h-4" />
          Listings ({products.length})
        </button>
        <button
          onClick={() => setTab("users")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === "users" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          Users ({users.length})
        </button>
        <button
          onClick={() => setTab("orders")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === "orders" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          Orders ({orders.length})
        </button>
        <button
          onClick={() => setTab("analytics")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === "analytics" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Analytics
        </button>
        <button
          onClick={() => setTab("subscribers")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === "subscribers" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Bell className="w-4 h-4" />
          Subscribers ({subscribers.length})
        </button>
        <button
          onClick={() => setTab("inventory")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === "inventory" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Inventory
        </button>
      </div>

      {tab === "listings" ? (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <img
                src={p.image_url}
                alt={p.title}
                className="w-12 h-12 rounded-lg object-cover shrink-0"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-primary font-semibold text-sm">£{p.price?.toFixed(2)}</span>
                  <Badge variant={statusVariant(p.status)} className="text-[10px]">
                    {p.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{p.category}</span>
                </div>
              </div>
              {p.status !== "removed" && (
                <button
                  onClick={() => handleRemoveListing(p.id)}
                  className="shrink-0 w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : tab === "users" ? (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-primary">
                  {u.full_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{u.full_name || u.email}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                    {u.role}
                  </Badge>
                  {u.banned && (
                    <Badge variant="destructive" className="text-[10px]">Banned</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Joined {moment(u.created_date).format("DD MMM YYYY")}
                  </span>
                </div>
              </div>
              {u.id !== user.id && (
                <button
                  onClick={() => handleToggleBan(u.id, u.banned)}
                  className={`shrink-0 px-3 h-9 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    u.banned
                      ? "border border-border text-green-600 hover:bg-green-50"
                      : "border border-border text-destructive hover:bg-destructive/10"
                  }`}
                >
                  {u.banned ? (
                    <><CheckCircle className="w-3.5 h-3.5" /> Unban</>
                  ) : (
                    <><Ban className="w-3.5 h-3.5" /> Ban</>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : tab === "analytics" ? (
        <AnalyticsTab orders={orders} products={products} users={users} />
      ) : tab === "inventory" ? (
        <InventoryMonitor />
      ) : tab === "subscribers" ? (
        <div className="space-y-2">
          {subscribers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No subscribers yet.</p>
          ) : (
            subscribers.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{s.email}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground truncate">
                      {s.product_title || s.product_id}
                    </span>
                    <Badge variant={s.status === "notified" ? "default" : "secondary"} className="text-[10px]">
                      {s.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {moment(s.created_date).format("DD MMM YYYY")}
                    </span>
                    {s.notified_date && (
                      <span className="text-[10px] text-muted-foreground">
                        Notified {moment(s.notified_date).format("DD MMM YYYY")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No orders yet.</p>
          ) : (
            orders.map((o) => (
              <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                {o.product_image && (
                  <img
                    src={o.product_image}
                    alt={o.product_title}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                    loading="lazy"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{o.product_title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-primary font-semibold text-sm">£{o.price?.toFixed(2)}</span>
                    <Badge
                      variant={o.status === "refunded" || o.status === "disputed" ? "destructive" : o.status === "completed" || o.status === "delivered" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {o.status?.replace("_", " ")}
                    </Badge>
                    <span className="text-xs text-muted-foreground truncate">
                      Buyer: {o.buyer_email}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {moment(o.created_date).format("DD MMM YYYY")}
                    </span>
                  </div>
                </div>
                {o.status !== "refunded" && o.status !== "pending_payment" && o.payment_intent_id && (
                  <button
                    onClick={() => handleRefund(o.id)}
                    disabled={refundingId === o.id}
                    className="shrink-0 px-3 h-9 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-border text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-60"
                  >
                    {refundingId === o.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    Refund
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}