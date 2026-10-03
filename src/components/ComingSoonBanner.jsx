import { Megaphone } from "lucide-react";

export default function ComingSoonBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-3.5 sm:px-5 py-3 shadow-lg flex items-center gap-3 sm:gap-4 min-h-[72px] sm:min-h-[80px]">
      {/* Megaphone on the left */}
      <div className="shrink-0 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/15 ring-1 ring-white/25">
        <Megaphone className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
      </div>

      {/* Headline + supporting text */}
      <div className="flex-1 min-w-0">
        <h2 className="text-base sm:text-2xl font-extrabold tracking-tight leading-none whitespace-nowrap">
          <span className="text-white">COMING </span>
          <span className="bg-gradient-to-r from-purple-300 to-blue-300 bg-clip-text text-transparent">SOON</span>
        </h2>
        <p className="text-white/90 text-[10px] sm:text-xs mt-1 leading-snug line-clamp-2">
          Exciting new features, better deals and a smoother shopping experience!
        </p>
      </div>

      {/* Tilted "Stay Tuned!" capsule on the right with a curved white arrow accent */}
      <div className="shrink-0 relative">
        <div className="rotate-[8deg] rounded-full bg-blue-500 ring-1 ring-white/30 px-3 py-1.5 shadow-md">
          <span className="text-white text-[10px] sm:text-xs font-bold tracking-wide whitespace-nowrap">
            Stay Tuned!
          </span>
        </div>
        <svg
          className="absolute -bottom-2.5 -left-2 w-4 h-4 text-white/85"
          viewBox="0 0 18 18"
          fill="none"
          aria-hidden="true"
        >
          <path d="M2 12 C 4 3, 13 3, 16 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M12.5 5.5 L16 9 L12.5 11.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
    </div>
  );
}