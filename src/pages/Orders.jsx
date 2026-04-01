import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Package, ShoppingBag, ArrowRight } from "lucide-react";
import moment from "moment";

const STATUS_COLORS = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  refunded: "bg-red-100 text-red-800",
  disputed: "bg-red-100 text-red-800",
};

function OrderCard({ order }) {
  return (
    <Link
      to={`/product/${order.product_id}`}
      className="flex gap-3 p-3 rounded-xl bg-card border border-border hover:shadow-md transition-all"
    >
      {order.product_image && (
        <img
          src={order.product_image}
          alt={order.product_title}
          className="w-16 h-16 rounded-lg object-cover shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{order.product_title}</p>
        <p className="text-primary font-bold text-sm">£{order.price?.toFixed(2)}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.status] || "bg-muted text-muted-foreground"}`}>
            {order.status?.replace("_", " ")}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {moment(order.created_date).fromNow()}
          </span>
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0 self-center" />
    </Link>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    const me = await base44.auth.me();
    setUser(me);
    const allOrders = await base44.entities.Order.list("-created_date", 100);
    setOrders(allOrders);
    setLoading(false);
  };

  const purchases = orders.filter((o) => o.buyer_email === user?.email);
  const sales = orders.filter((o) => o.seller_email === user?.email);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-6">
      <h1 className="text-2xl font-bold tracking-tight mb-1">My Orders</h1>
      <p className="text-sm text-muted-foreground mb-6">Track your purchases and sales</p>

      <Tabs defaultValue="purchases">
        <TabsList className="w-full rounded-xl h-11 mb-4">
          <TabsTrigger value="purchases" className="flex-1 gap-1.5 rounded-lg">
            <ShoppingBag className="w-4 h-4" />
            Purchases ({purchases.length})
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex-1 gap-1.5 rounded-lg">
            <Package className="w-4 h-4" />
            Sales ({sales.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="purchases" className="space-y-2">
          {purchases.length === 0 ? (
            <EmptyState text="No purchases yet" sub="Items you buy will appear here" />
          ) : (
            purchases.map((o) => <OrderCard key={o.id} order={o} />)
          )}
        </TabsContent>

        <TabsContent value="sales" className="space-y-2">
          {sales.length === 0 ? (
            <EmptyState text="No sales yet" sub="Items you sell will appear here" />
          ) : (
            sales.map((o) => <OrderCard key={o.id} order={o} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ text, sub }) {
  return (
    <div className="flex flex-col items-center py-16 text-center">
      <Package className="w-10 h-10 text-muted-foreground/30 mb-3" />
      <p className="font-medium text-muted-foreground">{text}</p>
      <p className="text-sm text-muted-foreground/70 mt-1">{sub}</p>
    </div>
  );
}