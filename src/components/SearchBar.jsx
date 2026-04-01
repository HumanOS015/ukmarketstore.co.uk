import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

const CATEGORIES = [
  "All Categories",
  "Electronics",
  "Fashion",
  "Home & Garden",
  "Sports",
  "Toys",
  "Motors",
  "Books",
  "Music",
  "Collectibles",
  "Health & Beauty",
  "Pet Supplies",
  "Other",
];

export default function SearchBar({ onSearch, onCategoryChange, searchValue, categoryValue }) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search UK listings..."
            value={searchValue}
            onChange={(e) => onSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-card border-border"
          />
          {searchValue && (
            <button
              onClick={() => onSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-xl shrink-0"
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </Button>
      </div>

      {showFilters && (
        <div className="flex gap-2 animate-in slide-in-from-top-2 duration-200">
          <Select value={categoryValue} onValueChange={onCategoryChange}>
            <SelectTrigger className="h-10 rounded-xl bg-card">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}