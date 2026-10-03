import { Megaphone } from "lucide-react";

export default function ComingSoonBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-5 sm:p-6 shadow-lg h-full flex flex-col justify-center min-h-[120px]">
      {/* Decorative glow blobs */}
      <div className="pointer-events-none absolute -top-10 -right-8 w-32 h-32 rounded-full bg-blue-500/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 w-28 h-28 rounded-full bg-purple-500/25 blur-3xl" />

      <div className="relative flex items-center gap-3">
        <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 ring-1 ring-white/20">
          <Megaphone className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-none">
            COMING SOON
          </h2>
          <p className="text-white/80 text-xs sm:text-sm mt-1.5 leading-snug">
            Exciting new features, better deals and a smoother shopping experience!
          </p>
        </div>
      </div>

      <div className="relative mt-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 ring-1 ring-white/25 text-white text-xs font-semibold tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Stay Tuned!
        </span>
      </div>
    </div>
  );
}