import { Link } from "react-router-dom";

// Mobile-only compact seller promo, placed to the right of the
// "Discover UK Deals" heading in the hero. Hidden on tablet/desktop (md:hidden).
// Whole card is tappable and links to the Sell page.
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
    <Link
      to="/sell"
      className="md:hidden shrink-0 w-[150px] rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 px-2 py-1.5 shadow active:scale-[0.99] transition-transform"
    >
      <ul className="space-y-0.5">
        {PERKS.map((perk) => (
          <li key={perk} className="flex gap-1 text-white text-[8.5px] leading-[1.15]">
            <span className="shrink-0">✅</span>
            <span>{perk}</span>
          </li>
        ))}
      </ul>
    </Link>
  );
}