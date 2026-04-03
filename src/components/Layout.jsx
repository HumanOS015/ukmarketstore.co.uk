import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, PlusCircle, ShoppingBag, User, Shield, FileText, LayoutDashboard } from "lucide-react";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/sell", icon: PlusCircle, label: "Sell" },
  { to: "/orders", icon: ShoppingBag, label: "Orders" },
  { to: "/seller-dashboard", icon: LayoutDashboard, label: "Selling" },
  { to: "/profile", icon: User, label: "Profile" },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">UK</span>
            </div>
            <span className="font-bold text-lg tracking-tight">UKMarket</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/buyer-protection"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <Shield className="w-3.5 h-3.5" />
              Buyer Protection
            </Link>
            <Link
              to="/terms"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Terms
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-6">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border md:hidden">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Side Nav */}
      <nav className="hidden md:flex fixed left-0 top-14 bottom-0 w-16 border-r border-border bg-card/50 backdrop-blur-xl flex-col items-center pt-4 gap-2 z-40">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <Link
              key={to}
              to={to}
              title={label}
              className={`flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all ${
                active
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
              <span className="text-[9px] font-medium">{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}