import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, Shield, BadgePercent, Lock, ArrowRight, X } from "lucide-react";

const SLIDES = [
  {
    icon: ShoppingBag,
    title: "Welcome to UKMarketStore",
    body: "Buy and sell across the United Kingdom — all in one trusted marketplace.",
    accent: "from-blue-500 to-indigo-500",
  },
  {
    icon: Shield,
    title: "Shop with confidence",
    body: "Every payment is held in escrow, dispatched via tracked UK delivery, and covered by our money-back guarantee.",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    icon: BadgePercent,
    title: "Sell in minutes",
    body: "List an item, connect Stripe, and keep 90% of every sale. We handle payments and protection.",
    accent: "from-amber-500 to-orange-500",
  },
  {
    icon: Lock,
    title: "Safe by design",
    body: "Verified sellers, no personal contact details shared, and disputes resolved by our team.",
    accent: "from-purple-500 to-fuchsia-500",
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const last = step === SLIDES.length - 1;
  const slide = SLIDES[step];
  const Icon = slide.icon;

  const finish = () => {
    try { localStorage.setItem("ukms_onboarded", "1"); } catch {}
    navigate("/");
  };
  const next = () => (last ? finish() : setStep((s) => s + 1));

  return (
    <div className="min-h-screen bg-background flex flex-col" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="flex justify-end p-4">
        <button onClick={finish} className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
          Skip <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <div className={`w-24 h-24 rounded-[2rem] bg-gradient-to-br ${slide.accent} flex items-center justify-center shadow-xl mb-8`}>
              <Icon className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-3">{slide.title}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">{slide.body}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex justify-center gap-2 mb-6">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-2 bg-muted"}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
        <button
          onClick={next}
          className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          {last ? "Get Started" : "Continue"}
          <ArrowRight className="w-4 h-4" />
        </button>
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="w-full h-10 mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back
          </button>
        )}
      </div>
    </div>
  );
}