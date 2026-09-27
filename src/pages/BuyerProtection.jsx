import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Shield,
  Lock,
  Truck,
  CheckCircle,
  CreditCard,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";

const steps = [
  {
    icon: CreditCard,
    title: "Secure Payment",
    description:
      "When you click 'Buy Now', your payment is processed securely through Stripe Connect. Your money never goes directly to the seller.",
  },
  {
    icon: Lock,
    title: "Funds Held for Transaction Processing",
    description:
      "Your payment is processed through our payment provider. The timing and release of funds are handled through the platform's payment system and applicable transaction rules. UKMarketStore's Buyer Protection process does not remove your legal rights against a business seller.",
  },
  {
    icon: Truck,
    title: "Seller Ships Item",
    description:
      "The seller dispatches your item to the address you provided. A tracking number is shared so you can follow your delivery.",
  },
  {
    icon: CheckCircle,
    title: "Confirm Delivery",
    description:
      "Once you receive the item and are satisfied, confirm delivery. The transaction is then completed in accordance with the platform's payment and protection process, subject to any dispute, refund or other applicable rights.",
  },
];

const faqs = [
  {
    q: "What if my item doesn't arrive?",
    a: "If your item doesn't arrive within the estimated delivery window, you can raise a dispute. We'll investigate and process a full refund if the seller can't provide proof of delivery.",
  },
  {
    q: "What if the item is not as described?",
    a: "You should report a problem as soon as possible through UKMarketStore so we can investigate. A platform dispute deadline may apply to the additional Buyer Protection process, but it does not remove or limit any statutory rights that apply to your purchase.",
  },
  {
    q: "How long does the seller have to ship?",
    a: "Sellers are expected to dispatch items within the marketplace's stated handling period and provide valid tracking where required. If a seller fails to dispatch in accordance with the marketplace rules, UKMarketStore may provide a platform refund in accordance with its Buyer Protection process.",
  },
  {
    q: "Is my payment information safe?",
    a: "Absolutely. All payments are processed through Stripe, a PCI-DSS Level 1 certified payment provider. We never store your card details.",
  },
];

export default function BuyerProtection() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-6">
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Buyer Protection</h1>
          <p className="text-sm text-muted-foreground">
            Your money is safe with UKMarketStore
          </p>
        </div>
      </div>

      {/* Intro */}
      <div className="mt-6 p-4 rounded-2xl bg-primary/5 border border-primary/10">
        <p className="text-sm leading-relaxed text-muted-foreground">
          UKMarketStore provides an additional Buyer Protection process for purchases made through the platform. It is designed to help when an order is not delivered or there is a significant problem with the item. This platform protection does not replace or limit any statutory rights that may apply to you.
        </p>
      </div>

      {/* How it works */}
      <h2 className="text-lg font-semibold mt-8 mb-4">How It Works</h2>
      <div className="space-y-0">
        {steps.map((step, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shrink-0">
                <step.icon className="w-5 h-5 text-primary" />
              </div>
              {i < steps.length - 1 && (
                <div className="w-px h-full bg-border my-1" />
              )}
            </div>
            <div className="pb-6">
              <h3 className="font-semibold text-sm">
                Step {i + 1}: {step.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Commission info */}
      <div className="mt-4 p-4 rounded-2xl bg-muted/50 border border-border">
        <h3 className="font-semibold text-sm mb-1">10% Commission</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          UKMarketStore charges a 10% commission on every sale. This covers payment
          processing, buyer protection, dispute resolution, and platform
          maintenance. Sellers see the exact payout amount before listing.
        </p>
      </div>

      {/* FAQs */}
      <h2 className="text-lg font-semibold mt-8 mb-4 flex items-center gap-2">
        <HelpCircle className="w-5 h-5" />
        Frequently Asked Questions
      </h2>
      <div className="space-y-3">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="p-4 rounded-2xl bg-card border border-border"
          >
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-primary shrink-0" />
              {faq.q}
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed pl-5.5">
              {faq.a}
            </p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-8 text-center">
        <Button onClick={() => navigate("/")} className="rounded-xl h-11 px-8">
          Start Shopping Safely
        </Button>
      </div>
    </div>
  );
}