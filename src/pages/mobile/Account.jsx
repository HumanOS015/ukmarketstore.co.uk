import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import {
  ShoppingBag, Heart, MessageCircle, Bell, LayoutDashboard, User as UserIcon,
  Shield, RotateCcw, LifeBuoy, FileText, Lock, LogOut, ChevronRight, ShieldCheck,
  Trash2, Sparkles,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const LOGO =
  "https://media.base44.com/images/public/69cdac0e3dd4898d79118860/dd93ae03f_Copilot_20260912_230059.png";

const sections = [
  { to: "/welcome", icon: Sparkles, label: "How It Works", desc: "Take a quick tour" },
  { to: "/orders", icon: ShoppingBag, label: "My Orders", desc: "Track purchases & sales" },
  { to: "/wishlist", icon: Heart, label: "Saved Listings" },
  { to: "/messages", icon: MessageCircle, label: "Messages" },
  { to: "/notifications", icon: Bell, label: "Notifications" },
  { to: "/seller-dashboard", icon: LayoutDashboard, label: "Seller Dashboard" },
  { to: "/profile", icon: UserIcon, label: "Profile" },
  { to: "/buyer-protection", icon: Shield, label: "Buyer Protection" },
  { to: "/returns", icon: RotateCcw, label: "Returns & Cancellations" },
  { to: "/buyer-protection-assistant", icon: LifeBuoy, label: "Help & Support" },
  { to: "/terms", icon: FileText, label: "Terms" },
  { to: "/privacy", icon: Lock, label: "Privacy" },
];

export default function Account() {
  const { user, isAuthenticated, navigateToLogin, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await base44.functions.invoke("deleteAccount", {});
      toast.success("Your account data has been removed");
      logout();
    } catch (err) {
      console.error("Account deletion failed", err);
      toast.error("Couldn't delete your account. Please try again.");
      setDeleting(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="flex items-center gap-3 mb-5">
        <img src={LOGO} alt="UKMarketStore" className="w-11 h-11 rounded-xl object-contain" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Account</h1>
          <p className="text-xs text-muted-foreground">UKMarketStore</p>
        </div>
      </div>

      {isAuthenticated && user ? (
        <div className="flex items-center gap-3 rounded-2xl bg-card border border-border p-4 mb-5">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <UserIcon className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{user.full_name || user.email}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            {user.role === "admin" && (
              <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-primary">
                <ShieldCheck className="w-3 h-3" /> Administrator
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 p-5 mb-5 text-white">
          <h2 className="font-bold text-lg">Welcome</h2>
          <p className="text-sm text-white/85 mt-1">
            Sign in to buy, sell and track your orders.
          </p>
          <button
            onClick={navigateToLogin}
            className="mt-3 inline-flex items-center justify-center px-5 h-10 rounded-xl bg-white text-sm font-semibold text-blue-700 active:scale-95 transition-transform"
          >
            Sign In / Register
          </button>
        </div>
      )}

      <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden mb-4">
        {sections.map(({ to, icon: Icon, label, desc }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors"
          >
            <Icon className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{label}</p>
              {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
        ))}
      </div>

      {user?.role === "admin" && (
        <Link
          to="/admin"
          className="flex items-center gap-3 rounded-2xl bg-card border border-border px-4 py-3.5 mb-4 hover:bg-muted/50 transition-colors"
        >
          <Shield className="w-5 h-5 text-primary" />
          <span className="flex-1 text-sm font-medium">Admin Console</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      )}

      {isAuthenticated && (
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border border-border text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      )}

      {isAuthenticated && (
        <div className="mt-4">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border border-destructive/30 text-sm font-medium text-destructive hover:bg-destructive/5 transition-colors">
                <Trash2 className="w-4 h-4" />
                Delete Account
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes your listings, saved items, saved searches, reviews and notifications. This cannot be undone. You'll be signed out afterwards.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleting ? "Deleting…" : "Yes, delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <p className="text-center text-[10px] text-muted-foreground mt-5">
        © {new Date().getFullYear()} UKMarketStore · ukmarketstore.co.uk
      </p>
    </div>
  );
}