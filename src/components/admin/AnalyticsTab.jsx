import { useMemo } from "react";
import { TrendingUp, PoundSterling, Lock, RotateCcw, Users, Package } from "lucide-react";

const ACTIVE_STATUSES = ["paid", "shipped", "delivered", "completed"];

export default function AnalyticsTab({ orders, products, users }) {
  const stats = useMemo(() => {
    const gmv = orders
      .filter((o) => ACTIVE_STATUSES.includes(o.status))
      .reduce((s, o) => s + (o.price || 0), 0);

    const inEscrow = orders
      .filter((o) => ["paid", "shipped", "delivered"].includes(o.status))
      .reduce((s, o) => s + (o.price || 0), 0);

    const commissionEarned = orders
      .filter((o) => o.status === "completed")
      .reduce((s, o) => s + (o.commission || 0), 0);

    const refundedTotal = orders
      .filter((o) => o.status === "refunded")
      .reduce((s, o) => s + (o.price || 0), 0);

    const paidOut = orders
      .filter((o) => o.status === "completed")
      .reduce((s, o) => s + (o.seller_payout || 0), 0);

    const funnel = {
      pending_payment: orders.filter((o) => o.status === "pending_payment").length,
      paid: orders.filter((o) => o.status === "paid").length,
      shipped: orders.filter((o) => o.status === "shipped").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      completed: orders.filter((o) => o.status === "completed").length,
      refunded: orders.filter((o) => o.status === "refunded").length,
    };

    const sellerMap = {};
    for (const o of orders) {
      if (!ACTIVE_STATUSES.includes(o.status)) continue;
      if (!sellerMap[o.seller_email]) sellerMap[o.seller_email] = { email: o.seller_email, sales: 0, orders: 0 };
      sellerMap[o.seller_email].sales += o.price || 0;
      sellerMap[o.seller_email].orders += 1;
    }
    const topSellers = Object.values(sellerMap).sort((a, b) => b.sales - a.sales).slice(0, 5);

    const catMap = {};
    for (const p of products) {
      const c = p.category || "Other";
      catMap[c] = (catMap[c] || 0) + 1;
    }
    const topCategories = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6);

    const activeListings = products.filter((p) => p.status === "active").length;

    return { gmv, inEscrow, commissionEarned, refundedTotal, paidOut, funnel, topSellers, topCategories, activeListings };
  }, [orders, products]);

  const fmt = (n) => `£${(n || 0).toFixed(2)}`;
  const maxFunnel = Math.max(1, ...Object.values(stats.funnel));

  return (
    <div className="space-y-6">
      {/* Headline money metrics */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard icon={<PoundSterling className="w-4 h-4" />} label="Gross Merchandise Value" value={fmt(stats.gmv)} tone="primary" />
        <MetricCard icon={<TrendingUp className="w-4 h-4" />} label="Commission Earned" value={fmt(stats.commissionEarned)} tone="green" />
        <MetricCard icon={<Lock className="w-4 h-4" />} label="Funds in Escrow" value={fmt(stats.inEscrow)} tone="amber" />
        <MetricCard icon={<RotateCcw className="w-4 h-4" />} label="Refunded" value={fmt(stats.refundedTotal)} tone="red" />
      </div>

      {/* Conversion funnel */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Order Funnel</h3>
        <div className="space-y-2">
          {[
            { key: "pending_payment", label: "Awaiting Payment", color: "bg-yellow-400" },
            { key: "paid", label: "Paid", color: "bg-blue-400" },
            { key: "shipped", label: "Shipped", color: "bg-purple-400" },
            { key: "delivered", label: "Delivered", color: "bg-teal-400" },
            { key: "completed", label: "Completed (released)", color: "bg-green-500" },
            { key: "refunded", label: "Refunded", color: "bg-red-400" },
          ].map(({ key, label, color }) => {
            const count = stats.funnel[key];
            const pct = (count / maxFunnel) * 100;
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{count}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top sellers + categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Top Sellers</h3>
          </div>
          {stats.topSellers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No sales yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topSellers.map((s, i) => (
                <div key={s.email} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="truncate text-muted-foreground">{s.email}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{s.orders} sold</span>
                    <span className="font-semibold text-primary">{fmt(s.sales)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <Package className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Listings by Category</h3>
          </div>
          {stats.topCategories.length === 0 ? (
            <p className="text-xs text-muted-foreground">No listings yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topCategories.map(([cat, count]) => (
                <div key={cat} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{cat}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Active listings</span>
            <span className="font-semibold text-green-600">{stats.activeListings}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, tone }) {
  const tones = {
    primary: "text-primary bg-primary/10",
    green: "text-green-600 bg-green-100",
    amber: "text-amber-600 bg-amber-100",
    red: "text-red-600 bg-red-100",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${tones[tone] || tones.primary}`}>
        {icon}
      </div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}