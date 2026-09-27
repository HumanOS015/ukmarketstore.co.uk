import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Bell, Check, CheckCheck, Loader2, MessageCircle, Package, CreditCard, Truck, AlertCircle, RefreshCw } from "lucide-react";
import { withTimeout } from "@/lib/withTimeout";
import { toast } from "sonner";

const ICONS = {
  message: MessageCircle,
  order: Package,
  shipping: Truck,
  delivery: Truck,
  payout: CreditCard,
  refund: CreditCard,
  dispute: AlertCircle,
  listing: Check
};

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      await withTimeout(base44.functions.invoke("sync-notifications", {}), 20000, "Updating notifications");
      const rows = await withTimeout(base44.entities.Notification.list("-created_date", 100), 15000, "Loading notifications");
      setNotifications(rows || []);
    } catch (err) {
      console.error("Failed to load notifications", err);
      if (err?.status === 401 || err?.status === 403) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markRead = async (notification) => {
    if (notification.read) return;
    try {
      await base44.entities.Notification.update(notification.id, { read: true });
      setNotifications((prev) => prev.map((n) => n.id === notification.id ? { ...n, read: true } : n));
    } catch (err) {
      toast.error("Couldn't update notification.");
    }
  };

  const markAllRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    try {
      await Promise.all(unread.map((n) => base44.entities.Notification.update(n.id, { read: true })));
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      toast.error("Couldn't mark all notifications as read.");
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (error) return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <Bell className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="font-medium">Couldn't load notifications</p>
      <p className="text-sm text-muted-foreground mt-1 mb-4">Your connection may have dropped. Try again.</p>
      <button onClick={load} className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium"><RefreshCw className="w-4 h-4" /> Retry</button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-6">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /><h1 className="text-2xl font-bold">Notifications</h1></div>
          <p className="text-sm text-muted-foreground mt-1">Orders, messages, sales and account updates.</p>
        </div>
        {unreadCount > 0 && <button onClick={markAllRead} className="text-xs font-medium text-primary flex items-center gap-1.5 whitespace-nowrap"><CheckCheck className="w-4 h-4" /> Mark all read</button>}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <Bell className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="font-medium">You're all caught up</p>
          <p className="text-sm text-muted-foreground mt-1">New marketplace activity will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const Icon = ICONS[n.type] || Bell;
            return (
              <Link
                key={n.id}
                to={n.link || "/notifications"}
                onClick={() => markRead(n)}
                className={`flex gap-3 p-4 rounded-2xl border transition-colors ${n.read ? "bg-card border-border" : "bg-primary/5 border-primary/20"}`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${n.read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}><Icon className="w-5 h-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2"><p className="font-semibold text-sm">{n.title}</p>{!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}</div>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-2">{n.created_date ? new Date(n.created_date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : ""}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}