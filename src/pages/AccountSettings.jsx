import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Save, UserRound, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/AuthContext";

export default function AccountSettings() {
  const { navigateToLogin } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const loadAccount = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (!active) return;
        setDisplayName(currentUser?.display_name || currentUser?.full_name || "");
        setPhone(currentUser?.phone || "");
        setEmail(currentUser?.email || "");
      } catch (error) {
        console.error("Failed to load account settings", error);
        if (error?.status === 401 || error?.status === 403) {
          navigateToLogin();
          return;
        }
        toast.error("Couldn't load your account details. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadAccount();
    return () => { active = false; };
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();
    const cleanedName = displayName.trim();
    if (!cleanedName) {
      toast.error("Please enter a display name.");
      return;
    }
    setSaving(true);
    try {
      const updatedUser = await base44.auth.updateMe({
        display_name: cleanedName,
        phone: phone.trim()
      });
      setDisplayName(updatedUser?.display_name || cleanedName);
      setPhone(updatedUser?.phone || phone.trim());
      toast.success("Account details updated successfully.");
    } catch (error) {
      console.error("Failed to update account details", error);
      toast.error("Couldn't save your account details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 md:pl-20">
      <Link to="/account" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Account
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <UserRound className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account details.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="rounded-2xl border border-border bg-card p-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="account-display-name">Display name</Label>
            <Input
              id="account-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="nickname"
              maxLength={100}
              placeholder="Enter your display name"
              required
            />
            <p className="text-xs text-muted-foreground">This name is used to identify you on UKMarketStore. Your original sign-in name is not changed.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-phone">Phone number (optional)</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="account-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                maxLength={30}
                placeholder="Enter your phone number"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-email">Sign-in email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="account-email" value={email} readOnly className="pl-9 bg-muted/40" />
            </div>
            <p className="text-xs text-muted-foreground">Your sign-in email is shown here and cannot be changed on this page.</p>
          </div>

          <Button type="submit" disabled={saving || loading} className="w-full sm:w-auto gap-2 rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      )}
    </div>
  );
}
