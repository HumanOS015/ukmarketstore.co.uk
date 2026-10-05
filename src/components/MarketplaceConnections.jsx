import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Link2, Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { toast } from "sonner";

// Marketplace Connections card for the Seller Dashboard. Shows connection
// status and, for eBay, the official OAuth "Connect eBay" action plus last
// sync / error / linked-listing count. Never requests or displays credentials.
export default function MarketplaceConnections() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getInventoryStatus", { view: "seller" });
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

  const handleConnectEbay = async () => {
    setConnecting(true);
    try {
      const res = await base44.functions.invoke("ebayOAuthStart", {});
      if (!res.data?.url) {
        toast.error(res.data?.error || "eBay is not configured yet");
        return;
      }
      const isFramed = window.self !== window.top;
      if (isFramed) {
        window.open(res.data.url, "_blank");
      } else {
        window.location.href = res.data.url;
      }
    } catch (e) {
      toast.error("Couldn't start eBay connection");
    } finally {
      setConnecting(false);
    }
  };

  const connections = status?.connections || {};
  const ebay = status?.ebay || {};
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

  const ebayState = connections.eBay || "not_connected";

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

          {/* eBay connection management */}
          <div className="rounded-xl border border-border p-3 mb-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div>
                <p className="text-xs font-semibold">eBay</p>
                <p className="text-[10px] text-muted-foreground capitalize">
                  {ebayState.replace("_", " ")}
                  {ebay.environment ? ` · ${ebay.environment}` : ""}
                  {!ebay.configured ? " · not configured" : ""}
                </p>
              </div>
              {ebayState !== "connected" ? (
                <button
                  onClick={handleConnectEbay}
                  disabled={connecting || !ebay.configured}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-9 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                >
                  {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                  Connect eBay
                </button>
              ) : (
                <Link
                  to="/seller-inventory"
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 h-9 rounded-xl border border-border hover:bg-muted"
                >
                  Manage
                </Link>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
              <span>Linked listings: {ebay.linked_listings ?? 0}</span>
              {ebay.last_sync && <span>Last sync: {new Date(ebay.last_sync).toLocaleDateString()}</span>}
              {ebay.connection_error && <span className="text-red-600">{ebay.connection_error}</span>}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground mb-3">
            eBay is connected as an <span className="font-medium">inventory &amp; sale detection</span> connection —
            eBay sales automatically reduce your UKMarketStore stock. UKMarketStore never creates or edits eBay
            listings, and never touches eBay payouts or payments. Vinted uses a manual "Sold Elsewhere" fallback.
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