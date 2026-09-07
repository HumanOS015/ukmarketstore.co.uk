import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw } from "lucide-react";

const sections = [
  {
    title: "1. Your Right to Cancel",
    content: `Under the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, you have the right to cancel most online purchases within 14 days, beginning the day after you receive your item. This applies to buyers purchasing from sellers on UKMarketStore. UKMarketStore is a marketplace that connects buyers and sellers; the individual seller is responsible for honouring your cancellation and refund rights.`,
  },
  {
    title: "2. How to Cancel",
    content: `To cancel an order, contact us at ukmarketstore@hotmail.com within 14 days of receiving your item, quoting your order number. We will forward your cancellation request to the seller and coordinate the return and refund through UKMarketStore's escrow system. If your order has not yet been dispatched, we can cancel it and refund you immediately.`,
  },
  {
    title: "3. Refund Timeline",
    content: `Once we receive your cancellation request, the seller must refund you within 14 days. The refund will be returned to your original payment method. Where possible, UKMarketStore will release the funds held in escrow back to you as soon as the seller confirms the returned item has been received back.`,
  },
  {
    title: "4. Returning the Item",
    content: `Unless the item is faulty, not as described, or the seller has agreed otherwise, you are responsible for the cost of returning the item to the seller and for ensuring it is returned in a reasonable condition. Sellers must not refuse a valid return. If the seller fails to dispatch the item or provide a valid UK tracking number within 3 business days of sale, you are entitled to a full automatic refund with no return required.`,
  },
  {
    title: "5. Items That Cannot Be Returned",
    content: `The right to cancel does not apply to: personalised or custom-made items, sealed goods that have been unsealed after delivery (such as cosmetics, food, or software), items that by their nature cannot be returned (such as perishable goods), or items that have been damaged or altered after delivery. This is in addition to your statutory rights if goods are faulty or not as described.`,
  },
  {
    title: "6. Faulty or Misdescribed Items",
    content: `If an item arrives faulty, damaged, or significantly not as described, you are entitled to a full refund (including return postage) regardless of the 14-day window. Report the issue to ukmarketstore@hotmail.com as soon as possible and within 48 hours of delivery so we can hold the seller's escrow funds pending resolution.`,
  },
  {
    title: "7. Seller Responsibilities",
    content: `Sellers must comply with UK consumer law and accept valid cancellations and returns. Sellers who repeatedly refuse valid returns may be suspended from UKMarketStore. The platform retains escrowed funds until a transaction is resolved to protect buyers.`,
  },
  {
    title: "8. Contact Us",
    content: `If you have any questions about returns or cancellations, please contact us at ukmarketstore@hotmail.com and include your order number and details of the issue.`,
  },
];

export default function Returns() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <RotateCcw className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Returns & Cancellation</h1>
          <p className="text-sm text-muted-foreground">Last updated: 1 April 2026</p>
        </div>
      </div>

      <div className="mt-6 p-4 rounded-2xl bg-primary/5 border border-primary/10">
        <p className="text-sm leading-relaxed text-muted-foreground">
          UKMarketStore buyers have a statutory 14-day right to cancel most online purchases,
          plus full protection if an item is faulty or not as described.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {sections.map((section, i) => (
          <div key={i}>
            <h2 className="text-base font-semibold mb-2">{section.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}