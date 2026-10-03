import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/ui/drawer";
import { Check, ChevronDown } from "lucide-react";

/**
 * Responsive select: renders a native-style Vaul slide-up drawer on screens
 * under 768px and the standard shadcn Select popover on desktop. Accepts
 * `options` as an array of strings or { value, label } objects.
 */
export function ResponsiveSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  triggerClassName = "",
  ariaLabel,
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const selectedLabel = opts.find((o) => o.value === value)?.label;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel || placeholder}
            className={cn(
              "inline-flex items-center justify-between gap-2 px-3 rounded-xl bg-card border border-input text-sm w-full",
              triggerClassName,
              "h-11"
            )}
          >
            <span className={selectedLabel ? "text-foreground" : "text-muted-foreground"}>
              {selectedLabel || placeholder}
            </span>
            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
          </button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[70vh]">
          <DrawerHeader className="px-4">
            <DrawerTitle>{placeholder}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-2 pb-[env(safe-area-inset-bottom)]">
            {opts.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onValueChange(o.value);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between px-4 h-12 text-sm rounded-lg hover:bg-accent transition-colors"
              >
                <span className="truncate">{o.label}</span>
                {o.value === value && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("h-11 rounded-xl", triggerClassName)} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}