import { useEffect, useRef, useState } from "react";

/**
 * Simple pull-to-refresh gesture for a scrollable feed.
 * Attach the returned ref to the feed container. When the page is scrolled
 * to the top and the user drags downward, a pull distance is exposed for an
 * indicator; releasing past `threshold` calls `onRefresh`.
 */
export function usePullToRefresh(ref, onRefresh, { threshold = 70, max = 110, resistance = 0.5 } = {}) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const cb = useRef(onRefresh);
  cb.current = onRefresh;

  const state = useRef({ startY: null, pulling: false, dist: 0, refreshing: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onStart = (e) => {
      if (state.current.refreshing) return;
      if (window.scrollY > 0) {
        state.current.startY = null;
        return;
      }
      state.current.startY = e.touches[0].clientY;
      state.current.pulling = false;
    };

    const onMove = (e) => {
      if (state.current.startY == null || state.current.refreshing) return;
      const delta = e.touches[0].clientY - state.current.startY;
      if (window.scrollY <= 0 && delta > 0) {
        state.current.pulling = true;
        const dist = Math.min(delta * resistance, max);
        state.current.dist = dist;
        setPullDistance(dist);
        if (e.cancelable) e.preventDefault();
      }
    };

    const onEnd = async () => {
      if (!state.current.pulling) {
        state.current.startY = null;
        return;
      }
      state.current.pulling = false;
      state.current.startY = null;
      const reached = state.current.dist >= threshold;
      state.current.dist = 0;
      if (reached) {
        state.current.refreshing = true;
        setRefreshing(true);
        setPullDistance(threshold);
        try {
          await cb.current();
        } catch (err) {
          console.error("Pull-to-refresh failed", err);
        } finally {
          state.current.refreshing = false;
          setRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [ref, threshold, max, resistance]);

  return { pullDistance, refreshing };
}