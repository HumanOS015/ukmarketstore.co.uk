import { useTabMemory } from "@/lib/TabMemoryContext";
import { Home, Search, LayoutGrid, PlusCircle, User } from "lucide-react";

const leftTabs = [
  { key: "home", icon: Home, label: "Home" },
  { key: "search", icon: Search, label: "Search" },
];

const rightTabs = [
  { key: "categories", icon: LayoutGrid, label: "Categories" },
  { key: "account", icon: User, label: "Account" },
];

// Tab is declared at module level so it never remounts between renders — a
// re-created component identity can swallow taps fired mid-render. Each tab is
// flex-1 h-full so the entire cell is one large touch target (eBay-style).
function Tab({ tab, icon: Icon, label, active, onSwitch }) {
  return (
    <button
      type="button"
      onClick={() => onSwitch(tab)}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`flex-1 h-full min-h-[56px] flex flex-col items-center justify-center gap-1 select-none active:bg-muted/60 transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className={`w-6 h-6 ${active ? "stroke-[2.5]" : ""}`} />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  );
}

export default function MobileTabBar() {
  const { activeTab, switchTab } = useTabMemory();

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-20 max-w-md mx-auto">
        {leftTabs.map((t) => (
          <Tab key={t.key} {...t} active={activeTab === t.key} onSwitch={switchTab} />
        ))}

        {/* Centre Sell button */}
        <button
          type="button"
          onClick={() => switchTab("sell")}
          aria-label="Sell"
          className="flex-1 flex flex-col items-center justify-end gap-1 pb-1.5 active:scale-95 transition-transform"
        >
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
              activeTab === "sell" ? "bg-primary/90" : "bg-primary"
            }`}
          >
            <PlusCircle className="w-8 h-8 text-white stroke-[2]" />
          </div>
          <span className="text-[11px] font-medium text-primary">Sell</span>
        </button>

        {rightTabs.map((t) => (
          <Tab key={t.key} {...t} active={activeTab === t.key} onSwitch={switchTab} />
        ))}
      </div>
    </nav>
  );
}