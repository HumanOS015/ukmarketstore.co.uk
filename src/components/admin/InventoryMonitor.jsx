import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import moment from "moment";

// Admin inventory-protection monitoring tab. Shows aggregate stats, recent
// audit events and unmatched external events. Never exposes seller tokens
// (none are stored in the connection entity).
export default function InventoryMonitor() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("getInventoryStatus", {});
      setData(res.data);
    } catch (e) {
      toast.error("Failed to load inventory monitoring");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  const stats = data?.stats || {};
  const audit = data?.audit || [];
  const unmatched = data?.unmatched || [];

  const statCards = [
    { label: "Connected marketplaces", value: stats.connected_marketplaces ?? 0 },
    { label: "Active syncs", value: stats.active_syncs ?? 0 },
    { label: "Successful syncs", value: stats.successful_syncs ?? 0 },
    { label: "Failed syncs", value: stats.failed_syncs ?? 0 },
    { label: "Protected listings", value: stats.protected_listings ?? 0 },
    { label: "Sold-elsewhere events", value: stats.sold_elsewhere_events ?? 0 },
    { label: "Unmatched events", value: stats.unmatched_events ?? 0 }
  ];

  const resultTone = (r) =>
    r === "success" ? "bg-green-100 text-green-700"
    : r === "failure" ? "bg-red-100 text-red-700"
    : r === "skipped" ? "bg-slate-100 text-slate-600"
    : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">Inventory Protection</h2>
        </div>
        <button onClick={load} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 text-center">
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Recent audit events</h3>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No events yet.</p>
        ) : (
          <div className="space-y-2">
            {audit.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.event_type?.replace(/_/g, " ")}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.seller_email}{a.marketplace ? ` · ${a.marketplace}` : ""}
                    {a.external_listing_id ? ` · ${a.external_listing_id}` : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{moment(a.created_date).format("DD MMM HH:mm")}</p>
                </div>
                <Badge variant="secondary" className={`text-[10px] ${resultTone(a.processing_result)}`}>
                  {a.processing_result}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-3">Unmatched external events</h3>
        {unmatched.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">None.</p>
        ) : (
          <div className="space-y-2">
            {unmatched.map((u) => (
              <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{u.marketplace} · {u.external_listing_id}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.error_message || "No matching UKMS listing"}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{u.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}