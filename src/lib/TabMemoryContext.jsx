import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Per-tab history preservation for the mobile tab bar. Each tab remembers the
// last route visited while it was active, so switching back to a tab returns
// you to where you were (plus scroll position) instead of always resetting to
// the tab root. The browser back/forward stack is left untouched (tab switches
// push normal history entries), so existing web navigation keeps working.
const TAB_ROOTS = {
  home: "/",
  search: "/search",
  categories: "/categories",
  sell: "/sell",
  account: "/account",
};

const tabForPath = (p) => {
  if (!p) return "home";
  if (p.startsWith("/search")) return "search";
  if (p.startsWith("/categories")) return "categories";
  if (p.startsWith("/sell")) return "sell";
  if (p.startsWith("/account")) return "account";
  return "home"; // product/category/browsing pages belong to the Home tab
};

const TabMemoryContext = createContext(null);

export function TabMemoryProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => tabForPath(location.pathname));
  const lastPath = useRef({ ...TAB_ROOTS });
  const scrollMemory = useRef({});

  // Remember the current path for the active tab; restore scroll on mobile only
  // (desktop keeps its existing scroll-on-navigation behaviour).
  useEffect(() => {
    lastPath.current[activeTab] = location.pathname;
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      const y = scrollMemory.current[location.pathname] ?? 0;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  }, [location.pathname, activeTab]);

  // Track scroll position per path (mobile only).
  useEffect(() => {
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    const onScroll = () => {
      scrollMemory.current[location.pathname] = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [location.pathname]);

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    navigate(lastPath.current[tab] ?? TAB_ROOTS[tab]);
  }, [navigate]);

  return (
    <TabMemoryContext.Provider value={{ activeTab, switchTab }}>
      {children}
    </TabMemoryContext.Provider>
  );
}

export const useTabMemory = () => useContext(TabMemoryContext);