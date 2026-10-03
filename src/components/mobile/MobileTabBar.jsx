import { Link, useLocation } from "react-router-dom";
import { Home, Search, LayoutGrid, PlusCircle, User } from "lucide-react";

// Direct <Link> navigation (not context-based navigate) so the tab buttons work
// reliably everywhere: mobile web, native webview, and desktop. The active state
// is derived from the current URL, matching how the header/desktop nav work.
const TABS = [
{ to: "/", icon: Home, label: "Home" },
{ to: "/search", icon: Search, label: "Search" },
{ to: "/categories", icon: LayoutGrid, label: "Categories" },
{ to: "/account", icon: User, label: "Account" }];


function TabItem({ to, icon: Icon, label, active }) {
  return (
    <Link
      to={to}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`flex-1 h-full min-h-[56px] flex flex-col items-center justify-center gap-1 select-none active:bg-muted/60 transition-colors ${
      active ? "text-primary" : "text-muted-foreground"}`
      }>
      
      <Icon className={`w-6 h-6 ${active ? "stroke-[2.5]" : ""}`} />
      <span className="text-[11px] font-medium">{label}</span>
    </Link>);

}

export default function MobileTabBar() {
  const { pathname } = useLocation();
  const isActive = (to) => to === "/" ? pathname === "/" : pathname.startsWith(to);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      
      <div className="flex items-stretch h-20 max-w-md mx-auto">
        <TabItem {...TABS[0]} active={isActive(TABS[0].to)} />

        {/* Centre Sell button */}
        <Link
          to="/sell"
          aria-label="Sell"
          aria-current={isActive("/sell") ? "page" : undefined}
          className="flex-1 flex flex-col items-center justify-end gap-1 pb-1.5 active:scale-95 transition-transform">
          
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
            isActive("/sell") ? "bg-primary/90" : "bg-primary"}`
            }>
            
            <PlusCircle className="w-8 h-8 text-white stroke-[2] mr-1" />
          </div>
          <span className="text-[11px] font-medium text-primary">Sell</span>
        </Link>

        <TabItem {...TABS[1]} active={isActive(TABS[1].to)} />
        <TabItem {...TABS[2]} active={isActive(TABS[2].to)} />
        <TabItem {...TABS[3]} active={isActive(TABS[3].to)} />
      </div>
    </nav>);

}