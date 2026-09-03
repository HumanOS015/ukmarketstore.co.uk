import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Mail, LogOut, Plus, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { withTimeout } from "@/lib/withTimeout";
import ProductCard from "../components/ProductCard";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [myListings, setMyListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { navigateToLogin } = useAuth();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    setError(false);
    try {
      const me = await withTimeout(base44.auth.me(), 15000, "Loading profile");
      setUser(me);
      const listings = await withTimeout(
        base44.entities.Product.filter({ seller_email: me.email }, "-created_date", 50),
        15000,
        "Loading listings"
      );
      setMyListings(listings);
    } catch (err) {
      console.error("Failed to load profile", err);
      if (err?.status === 401 || err?.status === 403) {
        // Session expired — send the user back to sign in.
        navigateToLogin();
        return;
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    try {
      await base44.entities.Product.update(productId, { status: "removed" });
      setMyListings((prev) => prev.filter((p) => p.id !== productId));
      toast.success("Listing removed");
    } catch (err) {
      console.error("Failed to remove listing", err);
      toast.error("Couldn't remove the listing. Please try again.");
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
        <p className="font-medium text-muted-foreground">Couldn't load your profile</p>
        <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
          Your connection may have dropped. Try again.
        </p>
        <button
          onClick={loadProfile}
          className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  const activeListings = myListings.filter((l) => l.status === "active");
  const soldListings = myListings.filter((l) => l.status === "sold");

  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <User className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{user?.full_name || "User"}</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Mail className="w-3.5 h-3.5" />
            {user?.email}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">{activeListings.length}</p>
          <p className="text-xs text-muted-foreground">Active</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">{soldListings.length}</p>
          <p className="text-xs text-muted-foreground">Sold</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold">
            £{soldListings.reduce((sum, l) => sum + (l.price || 0), 0).toFixed(0)}
          </p>
          <p className="text-xs text-muted-foreground">Earned</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-6">
        <Link to="/sell" className="flex-1">
          <Button className="w-full gap-2 rounded-xl h-11">
            <Plus className="w-4 h-4" />
            New Listing
          </Button>
        </Link>
        <Button
          variant="outline"
          className="rounded-xl h-11 gap-2"
          onClick={() => base44.auth.logout()}
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>

      {/* My Listings */}
      <h2 className="text-lg font-semibold mb-3">My Listings</h2>
      {myListings.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No listings yet</p>
          <Link to="/sell" className="text-primary text-sm font-medium hover:underline">
            Create your first listing
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {myListings.map((product) => (
            <div key={product.id} className="relative group">
              <ProductCard product={product} />
              {product.status === "active" && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(product.id);
                  }}
                  className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}