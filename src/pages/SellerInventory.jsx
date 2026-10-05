import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
  ArrowLeft, Loader2, AlertCircle, Link2, Store, Tag, ShieldCheck, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

const MARKETPLACES = ["eBay", "Amazon", "Vinted", "Other"];

const STATUS_TONE = {
  active: "bg-green-100 text-green-700",
  sold: "bg-slate-100 text-slate-600",
  pending_stripe: "bg-amber-100 text-amber-700",
  removed: "bg-red-100 text-red-700"
};

export default function SellerInventory() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [soldDialog, setSoldDialog] = useState(null); // product
  const [soldMarketplace, setSoldMarketplace] = useState("Vinted");
  const [linkDialog, setLinkDialog] = useState(null);
  const [linkForm, setLinkForm] = useState({ marketplace: "eBay", external_listing_id: "", external_sku: "" });
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await base44.functions.invoke("getInventoryStatus", {});
      setData(res.data);
    } catch (e) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const confirmSoldElsewhere = async () => {
    if (!soldDialog) return;
    setBusy(true);
    try {
      const res = await base44.functions.invoke("markSoldElsewhere", {
        productId: soldDialog.id,
        marketplace: soldMarketplace
      });
      if (res.data?.status === "marked" || res.data?.status === "already_marked") {
        toast.success("Marked as sold elsewhere — listing is now unavailable");
        setSoldDialog(null);
        load();
      } else {
        toast.error(res.data?.error || "Couldn't update listing");
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || "Couldn't update listing");
    } finally {
      setBusy(false);
    }
  };

  const confirmLink = async () => {
    if (!linkDialog) return;
    if (!linkForm.external_listing_id.trim()) {
      toast.error("Enter the external listing ID");
      return;
    }
    setBusy(true);
    try {
      if (linkForm.marketplace === "eBay") {
        const verify = await base44.functions.invoke("ebayVerifyListing", {
          itemId: linkForm.external_listing_id.trim()
        });
        if (!verify.data?.verified) {
          toast.error(
            verify.data?.reason
              ? `eBay verification failed: ${verify.data.reason}`
              : "Couldn't verify this eBay listing belongs to your account"
          );
          setBusy(false);
          return;
        }
      }
      const res = await base44.functions.invoke("connectExternalListing", {
        productId: linkDialog.id,
        marketplace: linkForm.marketplace,
        external_listing_id: linkForm.external_listing_id.trim(),
        external_sku: linkForm.external_sku.trim() || null
      });
      if (res.data?.status === "mapped" || res.data?.status === "already_mapped") {
        toast.success("External listing linked");
        setLinkDialog(null);
        setLinkForm({ marketplace: "eBay", external_listing_id: "", external_sku: "" });
        load();
      } else {
        toast.error(res.data?.error || "Couldn't link listing");
      }
    } catch (e) {
      toast.error(e?.response?.data?.error || "Couldn't link listing");
    } finally {
      setBusy(false);
    }
  };

  const handleSyncEbay = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke("ebaySyncNow", {});
      if (res.data?.status === "checked") {
        toast.success(`eBay connection checked — ${res.data?.results?.length || 0} listing(s) verified`);
      } else if (res.data?.status === "reauth_required") {
        toast.error("eBay reauthorisation required — please reconnect your eBay account");
      } else if (res.data?.status === "not_connected") {
        toast.error("eBay is not connected");
      } else {
        toast.error(res.data?.error || "eBay sync failed");
      }
      load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "eBay sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleConnectEbay = async () => {
    try {
      const res = await base44.functions.invoke("ebayOAuthStart", {});
      if (!res.data?.url) {
        toast.error(res.data?.error || "eBay not configured");
        return;
      }
      const isFramed = window.self !== window.top;
      if (isFramed) window.open(res.data.url, "_blank");
      else window.location.href = res.data.url;
    } catch (e) {
      toast.error("Couldn't start eBay connection");
    }
  };

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
        <p className="font-medium text-muted-foreground">Couldn't load inventory</p>
        <button onClick={load} className="mt-4 px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium">
          Retry
        </button>
      </div>
    );
  }

  const products = data?.products || [];

  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-6 pb-28">
      <button
        onClick={() => navigate("/seller-dashboard")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </button>

      <div className="flex items-center gap-2 mb-6">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory Protection</h1>
          <p className="text-sm text-muted-foreground">
            Protect one physical item across UKMarketStore and external marketplaces
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Store className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Marketplace Connections</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {["eBay", "Amazon", "Vinted"].map((m) => {
            const state = data?.connections?.[m] || "not_connected";
            const tone = state === "connected"
              ? "bg-green-50 text-green-700 border-green-200"
              : state === "sync_error"
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-muted text-muted-foreground border-border";
            return (
              <div key={m} className={`rounded-xl border px-2 py-2 text-center ${tone}`}>
                <p className="text-xs font-medium">{m}</p>
                <p className="text-[10px] mt-0.5 capitalize">
                  {m === "Vinted" ? "Manual protection" : state.replace("_", " ")}
                </p>
              </div>
            );
          })}
        </div>
        {/* eBay connection management */}
        {(() => {
          const ebay = data?.ebay || {};
          const ebayState = data?.connections?.eBay || "not_connected";
          return (
            <div className="mt-3 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <p className="text-xs font-semibold">eBay</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {ebayState.replace("_", " ")}
                    {ebay.environment ? ` · ${ebay.environment}` : ""}
                    {!ebay.configured ? " · not configured" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {ebayState === "connected" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-1.5 h-9"
                      disabled={syncing}
                      onClick={handleSyncEbay}
                    >
                      {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Check connection
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="rounded-xl h-9"
                    disabled={!ebay.configured || syncing || ebayState === "connected"}
                    onClick={handleConnectEbay}
                  >
                    {ebayState === "connected" ? "Reconnect" : "Connect eBay"}
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                <span>Linked listings: {ebay.linked_listings ?? 0}</span>
                {ebay.last_sync && <span>Last sync: {new Date(ebay.last_sync).toLocaleString()}</span>}
                {ebay.connection_error && <span className="text-red-600">{ebay.connection_error}</span>}
              </div>
            </div>
          );
        })()}

        <p className="text-[11px] text-muted-foreground mt-3">
          eBay is connected as an <span className="font-medium">inventory &amp; sale detection</span> connection — eBay sales automatically reduce your UKMarketStore stock. UKMarketStore never creates or edits eBay listings, and never touches eBay payouts or payments. Vinted uses a manual "Sold Elsewhere" fallback.
        </p>
      </div>

      <h2 className="text-base font-semibold mb-3">Your Listings</h2>
      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center text-muted-foreground text-sm">
          No listings yet
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const isProtected = p.status === "sold" && p.sold_elsewhere;
            return (
              <div key={p.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm truncate">{p.title}</p>
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_TONE[p.status] || "bg-muted text-muted-foreground"}`}>
                    {p.status.replace("_", " ")}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Tag className="w-3 h-3" />
                    {p.inventory_sync_status?.replace(/_/g, " ") || "not connected"}
                  </Badge>
                  {isProtected && (
                    <Badge variant="secondary" className="text-[10px]">
                      Sold on {p.sold_elsewhere_marketplace}
                    </Badge>
                  )}
                </div>

                {!isProtected && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl gap-1.5"
                      onClick={() => setLinkDialog(p)}
                    >
                      <Link2 className="w-3.5 h-3.5" /> Link external listing
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => { setSoldDialog(p); setSoldMarketplace("Vinted"); }}
                    >
                      Sold elsewhere
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Sold Elsewhere dialog */}
      <Dialog open={!!soldDialog} onOpenChange={(o) => !o && setSoldDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as sold elsewhere</DialogTitle>
            <DialogDescription>
              This makes your UKMarketStore listing unavailable immediately and records which
              marketplace the item sold on. It cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm font-medium truncate">{soldDialog?.title}</p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Which marketplace?</label>
              <div className="grid grid-cols-2 gap-2">
                {MARKETPLACES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSoldMarketplace(m)}
                    className={`py-2 rounded-xl text-sm font-medium border transition-all ${
                      soldMarketplace === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setSoldDialog(null)}>Cancel</Button>
            <Button className="flex-1 rounded-xl" disabled={busy} onClick={confirmSoldElsewhere}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link external listing dialog */}
      <Dialog open={!!linkDialog} onOpenChange={(o) => { if (!o) setLinkDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Link an external listing</DialogTitle>
            <DialogDescription>
              Explicitly associate this UKMarketStore listing with a listing on another
              marketplace. The system never guesses — enter the exact external listing ID.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm font-medium truncate">{linkDialog?.title}</p>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Marketplace</label>
              <div className="grid grid-cols-4 gap-1.5">
                {MARKETPLACES.map((m) => (
                  <button
                    key={m}
                    onClick={() => setLinkForm((f) => ({ ...f, marketplace: m }))}
                    className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                      linkForm.marketplace === m
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted border-border text-muted-foreground"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">External listing ID</label>
              <Input
                placeholder="e.g. 1234567890"
                value={linkForm.external_listing_id}
                onChange={(e) => setLinkForm((f) => ({ ...f, external_listing_id: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">External SKU (optional)</label>
              <Input
                placeholder="e.g. SKU-001"
                value={linkForm.external_sku}
                onChange={(e) => setLinkForm((f) => ({ ...f, external_sku: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setLinkDialog(null)}>Cancel</Button>
            <Button className="flex-1 rounded-xl" disabled={busy} onClick={confirmLink}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Link listing"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}