import { Outlet, Link, useLocation } from "react-router-dom";
import { Home, PlusCircle, ShoppingBag, User, Shield, FileText, LayoutDashboard } from "lucide-react";

const navItems = [
{ to: "/", icon: Home, label: "Home" },
{ to: "/orders", icon: ShoppingBag, label: "Orders" },
{ to: "/seller-dashboard", icon: LayoutDashboard, label: "Selling" },
{ to: "/profile", icon: User, label: "Profile" }];


export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="https://media.base44.com/images/public/69cdac0e3dd4898d79118860/ad38efa69_no_change__2_.png"

            alt="UKMarketStore logo"
            className="w-10 h-10 rounded-lg object-contain opacity-100"
            fetchpriority="high" />
            
            <span className="font-bold tracking-tight text-sm">UKMarketStore</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/buyer-protection"
              className="flex items-center gap-1.5 text-xs font-medium hover:text-primary transition-colors mx-1 text-[hsl(var(--muted-foreground))] pl-3">
              
              <Shield className="w-3.5 h-3.5 text-[hsl(var(--chart-3))]" />
              Buyer Protection
            </Link>
            <Link
              to="/terms"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors">

              <FileText className="w-3.5 h-3.5 text-[hsl(var(--primary))]" />
              Terms
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-4 pt-8 pb-20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} UKMarket. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link to="/about" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">About</Link>
            <Link to="/contact" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">Contact</Link>
            <Link to="/buyer-protection" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">Buyer Protection</Link>
            <Link to="/terms" className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors">Terms</Link>
          </div>
        </div>
      </footer>

      {/* Bottom Nav — always fixed */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border">
        <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {/* Left two items */}
          {navItems.slice(0, 2).map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
                }>
                
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>);

          })}

          {/* Centre Sell Button */}
          <Link to="/sell" className="flex flex-col items-center gap-1 -mt-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
            location.pathname === "/sell" ? "bg-primary/90" : "bg-primary"}`
            }>
              <PlusCircle className="w-7 h-7 text-white stroke-[2]" />
            </div>
            <span className="text-[10px] font-medium text-primary">Sell</span>
          </Link>

          {/* Right two items */}
          {navItems.slice(2).map(({ to, icon: Icon, label }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
                }>
                
                <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
                <span className="text-[10px] font-medium">{label}</span>
              </Link>);

          })}
        </div>
      </nav>

    </div>);

}