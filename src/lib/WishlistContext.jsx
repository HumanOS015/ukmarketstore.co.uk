import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

const WishlistContext = createContext();

export const WishlistProvider = ({ children }) => {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState(new Set());

  const loadWishlist = useCallback(async () => {
    if (!user) return;
    try {
      const items = await base44.entities.Wishlist.filter({ buyer_email: user.email }, "-created_date", 500);
      setWishlistIds(new Set(items.map((i) => i.product_id)));
    } catch (err) {
      console.error("Failed to load wishlist", err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadWishlist();
    } else {
      setWishlistIds(new Set());
    }
  }, [user, loadWishlist]);

  const toggle = useCallback(async (productId) => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.pathname);
      return;
    }
    const isSaved = wishlistIds.has(productId);
    // Optimistic update
    setWishlistIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(productId);
      else next.add(productId);
      return next;
    });
    try {
      if (isSaved) {
        const items = await base44.entities.Wishlist.filter(
          { buyer_email: user.email, product_id: productId },
          "-created_date",
          1
        );
        if (items[0]) await base44.entities.Wishlist.delete(items[0].id);
      } else {
        await base44.entities.Wishlist.create({ buyer_email: user.email, product_id: productId });
      }
    } catch (err) {
      // Revert on failure
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.add(productId);
        else next.delete(productId);
        return next;
      });
      console.error("Wishlist toggle failed", err);
    }
  }, [user, wishlistIds]);

  const isSavedFn = useCallback((productId) => wishlistIds.has(productId), [wishlistIds]);

  return (
    <WishlistContext.Provider value={{ isSaved: isSavedFn, toggle, refresh: loadWishlist }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => useContext(WishlistContext);