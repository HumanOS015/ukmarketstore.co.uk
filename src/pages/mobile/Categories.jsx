import { Link } from "react-router-dom";
import {
  Smartphone, Shirt, Home as HomeIcon, Dumbbell, Gamepad2, Car, Book, Music,
  Trophy, HeartPulse, PawPrint, Package,
} from "lucide-react";

const CATEGORIES = [
  { name: "Electronics", icon: Smartphone, color: "from-blue-500 to-blue-600" },
  { name: "Fashion", icon: Shirt, color: "from-pink-500 to-rose-600" },
  { name: "Home & Garden", icon: HomeIcon, color: "from-emerald-500 to-green-600" },
  { name: "Sports", icon: Dumbbell, color: "from-orange-500 to-amber-600" },
  { name: "Toys", icon: Gamepad2, color: "from-yellow-500 to-amber-500" },
  { name: "Motors", icon: Car, color: "from-slate-600 to-slate-700" },
  { name: "Books", icon: Book, color: "from-amber-600 to-orange-700" },
  { name: "Music", icon: Music, color: "from-purple-500 to-violet-600" },
  { name: "Collectibles", icon: Trophy, color: "from-indigo-500 to-blue-600" },
  { name: "Health & Beauty", icon: HeartPulse, color: "from-rose-500 to-pink-600" },
  { name: "Pet Supplies", icon: PawPrint, color: "from-teal-500 to-cyan-600" },
  { name: "Other", icon: Package, color: "from-gray-500 to-gray-600" },
];

export default function Categories() {
  return (
    <div className="px-4 pt-4 pb-6">
      <h1 className="text-xl font-bold tracking-tight mb-4">Categories</h1>
      <div className="grid grid-cols-2 gap-3">
        {CATEGORIES.map(({ name, icon: Icon, color }) => (
          <Link
            key={name}
            to={`/category/${encodeURIComponent(name)}`}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-5 active:scale-95 transition-transform"
          >
            <div
              className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center shadow-md`}
            >
              <Icon className="w-6 h-6 text-white" />
            </div>
            <span className="text-sm font-medium text-center">{name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}