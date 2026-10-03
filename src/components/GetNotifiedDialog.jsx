import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Bell, CheckCircle2, MailCheck, LogIn } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function GetNotifiedDialog({ open, onOpenChange, product }) {
  const [status, setStatus] = useState("idle"); // idle | submitting | success | already
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Reset + resolve the signed-in user whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setStatus("idle");
    setError("");
    setCheckingAuth(true);
    base44
      .auth.me()
      .catch(() => null)
      .then((me) => {
        setUser(me);
        setCheckingAuth(false);
      });
  }, [open]);

  const handleSubmit = async () => {
    if (!user?.email) return;
    setError("");
    setStatus("submitting");
    try {
      const res = await base44.functions.invoke("subscribeLaunchAlert", {
        productId: product?.id,
        productTitle: product?.title,
      });
      if (res.data?.alreadySubscribed) {
        setStatus("already");
      } else if (res.data?.ok) {
        setStatus("success");
      } else {
        setError(res.data?.error || "Couldn't sign you up. Please try again.");
        setStatus("idle");
      }
    } catch (err) {
      const status = err?.response?.status || err?.status;
      const msg = err?.response?.data?.error || err?.data?.error;
      if (status === 401) {
        base44.auth.redirectToLogin(window.location.href);
        return;
      }
      setError(msg || "Couldn't sign you up. Please try again.");
      setStatus("idle");
    }
  };

  const signIn = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  const renderSignedOut = () => (
    <div className="px-5 pb-5 pt-2 text-center">
      <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
        <LogIn className="w-7 h-7 text-primary" />
      </div>
      <p className="text-sm font-medium text-foreground mb-1">
        Sign in to get notified
      </p>
      <p className="text-xs text-muted-foreground mb-5">
        Create an account or sign in, and we&apos;ll notify you when UKMarketstore
        opens to the public.
      </p>
      <Button onClick={signIn} className="w-full h-11 rounded-xl font-semibold gap-2">
        <LogIn className="w-4 h-4" />
        Sign In / Create Account
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[92vw] mx-auto rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-2">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Bell className="w-5 h-5 text-primary" />
            Get Notified
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            UKMarketstore is coming soon. Sign in and we&apos;ll notify you when
            UKMarketstore opens to the public.
          </DialogDescription>
        </DialogHeader>

        {checkingAuth ? (
          <div className="px-5 pb-5 pt-2 text-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />
          </div>
        ) : !user?.email ? (
          renderSignedOut()
        ) : status === "success" ? (
          <div className="px-5 pb-5 pt-2 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-sm font-medium text-foreground">
              You&apos;re signed up! We&apos;ll notify you when UKMarketstore opens
              to the public.
            </p>
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full h-11 rounded-xl mt-5 font-semibold"
            >
              Done
            </Button>
          </div>
        ) : status === "already" ? (
          <div className="px-5 pb-5 pt-2 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-3">
              <MailCheck className="w-8 h-8 text-amber-600" />
            </div>
            <p className="text-sm font-medium text-foreground">
              You&apos;re already signed up for a notification for this listing.
            </p>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full h-11 rounded-xl mt-5 font-semibold"
            >
              Close
            </Button>
          </div>
        ) : (
          <div className="px-5 pb-5 pt-2">
            {/* The listing this notification is for */}
            {product && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted mb-4">
                {product.image_url && (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{product.title}</p>
                  {product.price != null && (
                    <p className="text-primary font-bold text-sm">
                      £{product.price.toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Account email — verified at sign-in */}
            <div className="p-3 rounded-xl bg-muted text-sm mb-1">
              <span className="text-muted-foreground">Notifying </span>
              <span className="font-medium break-all">{user.email}</span>
            </div>

            {error && (
              <p className="text-xs text-destructive mt-2">{error}</p>
            )}

            <div className="flex gap-2 mt-5">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 h-12 rounded-xl font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={status === "submitting"}
                className="flex-1 h-12 rounded-xl font-semibold gap-2"
              >
                {status === "submitting" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    Notify Me
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}