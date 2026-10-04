import { Link } from "react-router-dom";
import { Check } from "lucide-react";

// Mobile-only seller recruitment banner shown at the top of the homepage,
// in the empty space above the "Discover UK Deals" heading.
// Hidden on tablet/desktop (md:hidden).
const PERKS = [
  "List unlimited products for free",
  "No upfront costs",
  "Pay just 10% when your item sells",
  "Secure Stripe payments",
  "Tracked delivery for buyer and seller protection",
  "UK-based marketplace",
];

export default function SellPromoBanner() {
  return (
    <div className="md:hidden rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 px-4 py-4 shadow-md mb-4">
      <h2 className="text-base font-extrabold tracking-tight text-white leading-tight">
        SELL ON UKMARKETSTORE FOR FREE
      </h2>
      <ul className="mt-2.5 space-y-1.5">
        {PERKS.map((perk) => (
          <li key={perk} className="flex items-start gap-2 text-white/95">
            <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-300" />
            <span className="text-[12px] leading-snug">{perk}</span>
          </li>
        ))}
      </ul>
      <Link
        to="/sell"
        className="mt-3.5 flex items-center justify-center w-full h-12 rounded-xl bg-white text-blue-700 text-sm font-extrabold tracking-wide shadow-sm active:scale-[0.98] transition-transform"
      >
        START SELLING TODAY
      </Link>
    </div>
  );
}