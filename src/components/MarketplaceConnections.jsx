import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Link2, Loader2, ShieldCheck, Store } from "lucide-react";

// Minimal Marketplace Connections card for the Seller Dashboard. Shows the
// connection status of eBay / Amazon / Vinted using the existing UKMS design
// system. Does not request or display any marketplace credentials or tokens.
// A link to the full inventory protection screen is included.
export default function MarketplaceConnections() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getInventoryStatus", {});
      setStatus(res.data);
    } catch (e) {
      // Silent — secondary feature, dashboard must still render.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const connections = status?.connections || {};
  const marketplaces = [
    { key: "eBay", label: "eBay" },
    { key: "Amazon", label: "Amazon" },
    { key: "Vinted", label: "Vinted", manual: true }
  ];

  const tone = (state) =>
    state === "connected"
      ? "bg-green-50 text-green-700 border-green-200"
      : state === "sync_error"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-muted text-muted-foreground border-border";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Marketplace Connections</h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {marketplaces.map((m) => {
              const state = connections[m.key] || "not_connected";
              return (
                <div key={m.key} className={`rounded-xl border px-2 py-2 text-center ${tone(state)}`}>
                  <p className="text-xs font-medium">{m.label}</p>
                  <p className="text-[10px] mt-0.5 capitalize">
                    {m.manual ? "Manual protection" : state.replace("_", " ")}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            Automatic sync requires an authorised official marketplace integration. Vinted uses
            a manual "Sold Elsewhere" fallback — no scraping or password automation.
          </p>
          <Link
            to="/seller-inventory"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Link2 className="w-3.5 h-3.5" />
            Manage inventory protection
          </Link>
        </>
      )}
    </div>
  );
}