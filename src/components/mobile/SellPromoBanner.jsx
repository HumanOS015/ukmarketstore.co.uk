import { Link } from "react-router-dom";

// Mobile-only compact seller promo, placed to the right of the
// "Discover UK Deals" heading in the hero. Hidden on tablet/desktop (md:hidden).
// Kept deliberately small so it fits the narrow space beside the heading.
export default function SellPromoBanner() {
  return (
    <Link
      to="/sell"
      className="md:hidden shrink-0 w-[136px] rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 px-2.5 py-2 shadow-md active:scale-[0.98] transition-transform flex flex-col items-center justify-center text-center"
    >
      <span className="text-white text-[10px] font-extrabold leading-tight tracking-tight">
        SELL ON UKMARKETSTORE FOR FREE
      </span>
      <span className="mt-1.5 inline-flex items-center justify-center w-full h-8 rounded-md bg-white text-blue-700 text-[10px] font-extrabold tracking-wide">
        START SELLING TODAY
      </span>
    </Link>
  );
}