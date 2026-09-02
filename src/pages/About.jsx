import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Truck, Store } from "lucide-react";

export default function About() {
  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <h1 className="text-3xl font-bold tracking-tight mb-4">About UKMarket</h1>

      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p>
          UKMarket is a trusted marketplace built for buying and selling goods across the United Kingdom. We connect buyers and sellers in every corner of the country, from bustling cities to quiet rural towns, making it easy to find great deals on electronics, fashion, home goods, sports gear, collectibles, and much more — all in one place.
        </p>
        <p>
          Our platform is designed for everyone: individuals clearing out a spare room, hobbyists turning a passion into a side income, and small traders reaching customers nationwide. Every listing is managed by its seller, and every purchase is protected by our verified buyer protection. We require tracked UK delivery on all purchases, so you always know where your item is and your payment is held safely in escrow until delivery is confirmed.
        </p>
        <p>
          UKMarket is built and maintained by the UKMarket team, based in the UK. We believe shopping online should be safe, simple, and fair — for buyers and sellers alike. We charge a transparent 10% commission on completed sales only, with no hidden listing fees, and we reinvest in the platform to keep adding features that make buying and selling across the UK effortless.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8">
        <div className="rounded-2xl border border-border bg-card p-4">
          <Shield className="w-5 h-5 text-primary mb-2" />
          <p className="text-sm font-semibold">Escrow Protection</p>
          <p className="text-xs text-muted-foreground mt-1">Funds released only on delivery confirmation.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <Truck className="w-5 h-5 text-primary mb-2" />
          <p className="text-sm font-semibold">Tracked UK Delivery</p>
          <p className="text-xs text-muted-foreground mt-1">Mandatory tracked shipping on every order.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <Store className="w-5 h-5 text-primary mb-2" />
          <p className="text-sm font-semibold">Fair Commissions</p>
          <p className="text-xs text-muted-foreground mt-1">Just 10% on sale, no upfront listing fees.</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-8">
        Built by the UKMarket team for buyers and sellers across the United Kingdom.
      </p>
    </div>
  );
}