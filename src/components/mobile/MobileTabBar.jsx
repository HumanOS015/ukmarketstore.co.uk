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

export default function MobileTabBar() {
  const { activeTab, switchTab } = useTabMemory();

  const Tab = ({ tab, icon: Icon, label }) => {
    const active = activeTab === tab;
    // flex-1 h-full makes the entire grid cell one tappable target, so a finger
    // anywhere in the slot navigates — not just the icon centre.
    return (
      <button
        type="button"
        onClick={() => switchTab(tab)}
        className={`flex-1 h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
      >
        <Icon className={`w-5 h-5 ${active ? "stroke-[2.5]" : ""}`} />
        <span className="text-[10px] font-medium">{label}</span>
      </button>
    );
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-16 px-2 max-w-md mx-auto">
        {leftTabs.map((t) => (
          <Tab key={t.key} {...t} />
        ))}

        {/* Centre Sell button */}
        <button
          type="button"
          onClick={() => switchTab("sell")}
          className="flex-1 flex flex-col items-center justify-center gap-1 -mt-5"
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-transform active:scale-95 ${
              activeTab === "sell" ? "bg-primary/90" : "bg-primary"
            }`}
          >
            <PlusCircle className="w-7 h-7 text-white stroke-[2]" />
          </div>
          <span className="text-[10px] font-medium text-primary">Sell</span>
        </button>

        {rightTabs.map((t) => (
          <Tab key={t.key} {...t} />
        ))}
      </div>
    </nav>
  );
}