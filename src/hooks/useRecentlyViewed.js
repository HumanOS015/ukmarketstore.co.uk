import { useState, useEffect, useCallback } from "react";

const KEY = "ukms_recently_viewed";
const MAX = 10;

export function useRecentlyViewed() {
  const [ids, setIds] = useState([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setIds(JSON.parse(raw));
    } catch (e) {
      // ignore malformed storage
    }
  }, []);

  const record = useCallback((id) => {
    if (!id) return;
    setIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch (e) {
        // storage may be unavailable (private mode) — skip persist
      }
      return next;
    });
  }, []);

  return { ids, record };
}