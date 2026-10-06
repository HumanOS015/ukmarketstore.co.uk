import { ShieldCheck, Lock, Truck } from "lucide-react";

// Compact three-pillar trust badge row for the product detail page.
// Buyer Protection · Secure Escrow Payment · Tracked UK Delivery.
export default function TrustBadge() {
  const pillars = [
    {
      icon: ShieldCheck,
      title: "Buyer Protection",
      sub: "Money-back guarantee"
    },
    {
      icon: Lock,
      title: "Secure Payment",
      sub: "Escrow-held via Stripe"
    },
    {
      icon: Truck,
      title: "Tracked UK Delivery",
      sub: "Royal Mail tracked"
    }
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="grid grid-cols-3 gap-2">
        {pillars.map(({ icon: Icon, title, sub }) => (
          <div key={title} className="flex flex-col items-center text-center gap-1">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" strokeWidth={2} />
            </div>
            <p className="text-[11px] font-semibold leading-tight">{title}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}