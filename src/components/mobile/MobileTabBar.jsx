import { Link, useLocation } from "react-router-dom";
import { Home, Search, LayoutGrid, PlusCircle, User } from "lucide-react";

const leftTabs = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/search", icon: Search, label: "Search" },
];

const rightTabs = [
  { to: "/categories", icon: LayoutGrid, label: "Categories" },
  { to: "/account", icon: User, label: "Account" },
];

export default function MobileTabBar() {
  const location = useLocation();
  const isActive = (to) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  const Tab = ({ to, icon: Icon, label }) => {
    const active = isActive(to);
    return (
      <Link
        to={to}
        className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
        <span className="text-[10px] font-medium">{label}</span>
      </Link>
    );
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
        {leftTabs.map((t) => (
          <Tab key={t.to} {...t} />
        ))}

        {/* Centre Sell button */}
        <Link to="/sell" className="flex flex-col items-center gap-1 -mt-5">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
              location.pathname === "/sell" ? "bg-primary/90" : "bg-primary"
            }`}
          >
            <PlusCircle className="w-7 h-7 text-white stroke-[2]" />
          </div>
          <span className="text-[10px] font-medium text-primary">Sell</span>
        </Link>

        {rightTabs.map((t) => (
          <Tab key={t.to} {...t} />
        ))}
      </div>
    </nav>
  );
}