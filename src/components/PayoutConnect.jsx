import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CreditCard, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { withTimeout } from "@/lib/withTimeout";

export default function PayoutConnect({ user }) {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connectUrl, setConnectUrl] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!user?.email) {
        setLoading(false);
        return;
      }
      try {
        const accounts = await withTimeout(
          base44.entities.PayoutAccount.filter({ seller_email: user.email }),
          15000,
          "Loading payout status"
        );
        setAccount(accounts[0] || null);
      } catch (err) {
        console.error("Failed to load payout account", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const connect = async () => {
    setConnecting(true);
    try {
      const res = await withTimeout(
        base44.functions.invoke("createConnectAccount", {}),
        20000,
        "Preparing Stripe"
      );
      if (res.data?.url) {
        // Stripe onboarding can't load inside an iframe, and a programmatic
        // window.open after an async call gets blocked as a popup — so in an
        // iframe we surface a tappable link instead (a real user gesture opens it).
        if (window.self !== window.top) {
          setConnectUrl(res.data.url);
        } else {
          window.location.href = res.data.url;
        }
      } else {
        toast.error("Couldn't start payout setup");
      }
    } catch (err) {
      console.error("Connect failed", err);
      toast.error("Couldn't connect payouts. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Checking payout status…</span>
      </div>);

  }

  const connected = account?.charges_enabled;

  if (connected) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4 flex items-center gap-3">
        <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-800">Payouts connected</p>
          <p className="text-xs text-green-700">You'll receive 90% of each sale automatically via Stripe.</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={connect} disabled={connecting}>
          Manage
        </Button>
      </div>);

  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <CreditCard className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Connect your Stripe payouts</p>
          <p className="text-xs text-muted-foreground mt-1">
            Complete Stripe's secure setup to receive your earnings when your items sell.
          </p>
        </div>
      </div>
      {connectUrl ? (
        <Button asChild className="w-full rounded-xl">
          <a href={connectUrl} target="_blank" rel="noopener noreferrer">
            Continue to Stripe
          </a>
        </Button>
      ) : (
        <Button className="w-full rounded-xl" onClick={connect} disabled={connecting}>
          {connecting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Preparing Stripe…</>
          ) : (
            <><CreditCard className="w-4 h-4 mr-2" /> Connect Stripe payouts</>
          )}
        </Button>
      )}
      <p className="text-[11px] text-muted-foreground text-center">
        You'll be taken to Stripe to complete the payout setup securely.
      </p>
    </div>
  );




























}