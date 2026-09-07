import { useState, useEffect } from "react";
import { Cookie } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "ukm_cookie_consent";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const choose = (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-[5.5rem] left-0 right-0 z-40 px-4 max-w-lg mx-auto">
      <div className="rounded-2xl border border-border bg-card shadow-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Cookie className="w-4.5 h-4.5 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            We use essential cookies to keep you signed in and make the site work. See our{" "}
            <Link to="/privacy" className="text-primary font-medium hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => choose("accepted")}
            className="flex-1 h-9 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
          >
            Accept
          </button>
          <button
            onClick={() => choose("rejected")}
            className="flex-1 h-9 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}