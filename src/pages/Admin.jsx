import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Ban, CheckCircle, Shield, Users, Package } from "lucide-react";
import { toast } from "sonner";
import moment from "moment";

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("listings");
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== "admin") {
      navigate("/");
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === "admin") {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allProducts, allUsers] = await Promise.all([
        base44.entities.Product.list("-created_date", 500),
        base44.entities.User.list("-created_date", 500),
      ]);
      setProducts(allProducts);
      setUsers(allUsers);
    } catch (err) {
      console.error("Admin load failed", err);
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveListing = async (productId) => {
    try {
      await base44.entities.Product.update(productId, { status: "removed" });
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, status: "removed" } : p))
      );
      toast.success("Listing removed");
    } catch (err) {
      toast.error("Failed to remove listing");
    }
  };

  const handleToggleBan = async (userId, currentBanned) => {
    try {
      await base44.entities.User.update(userId, { banned: !currentBanned });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, banned: !currentBanned } : u))
      );
      toast.success(currentBanned ? "User unbanned" : "User banned");
    } catch (err) {
      toast.error("Failed to update user");
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const statusVariant = (status) =>
    status === "active" ? "default" : status === "sold" ? "secondary" : "destructive";

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-28">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Admin Panel</h1>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab("listings")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === "listings" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Package className="w-4 h-4" />
          Listings ({products.length})
        </button>
        <button
          onClick={() => setTab("users")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            tab === "users" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          Users ({users.length})
        </button>
      </div>

      {tab === "listings" ? (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <img
                src={p.image_url}
                alt={p.title}
                className="w-12 h-12 rounded-lg object-cover shrink-0"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-primary font-semibold text-sm">£{p.price?.toFixed(2)}</span>
                  <Badge variant={statusVariant(p.status)} className="text-[10px]">
                    {p.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{p.category}</span>
                </div>
              </div>
              {p.status !== "removed" && (
                <button
                  onClick={() => handleRemoveListing(p.id)}
                  className="shrink-0 w-9 h-9 rounded-lg border border-border flex items-center justify-center hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm font-semibold text-primary">
                  {u.full_name?.[0]?.toUpperCase() || u.email?.[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{u.full_name || u.email}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px]">
                    {u.role}
                  </Badge>
                  {u.banned && (
                    <Badge variant="destructive" className="text-[10px]">Banned</Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    Joined {moment(u.created_date).format("DD MMM YYYY")}
                  </span>
                </div>
              </div>
              {u.id !== user.id && (
                <button
                  onClick={() => handleToggleBan(u.id, u.banned)}
                  className={`shrink-0 px-3 h-9 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    u.banned
                      ? "border border-border text-green-600 hover:bg-green-50"
                      : "border border-border text-destructive hover:bg-destructive/10"
                  }`}
                >
                  {u.banned ? (
                    <><CheckCircle className="w-3.5 h-3.5" /> Unban</>
                  ) : (
                    <><Ban className="w-3.5 h-3.5" /> Ban</>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}