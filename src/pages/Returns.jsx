import { useNavigate } from "react-router-dom";
import { ArrowLeft, RotateCcw } from "lucide-react";

const sections = [
  {
    title: "1. Your Right to Cancel and return",
    content: `The return and cancellation rights depend on whether you buy from a private individual or a business/trader. Private sellers: a genuine private sale does not generally carry the trader's 14-day change-of-mind cancellation right. However, the seller must still comply with the legal terms that apply to the sale, including requirements concerning goods that are not as described or otherwise fail applicable legal standards. Business sellers (traders): for most online sales of goods, consumers have a statutory 14-day cancellation period under the Consumer Contracts Regulations 2013, subject to the legal exceptions. This is separate from rights that apply when goods are faulty, not as described or otherwise fail to meet statutory requirements.`,
  },
  {
    title: "2. How to Initiate a Return or Cancellation to cancel an error or request a return: ",
    content: `For Business Sales: You can exercise a statutory cancellation right by clearly notifying the business seller within the applicable cancellation period. UKMarketStore can provide a platform process for submitting the request, but the seller remains responsible for meeting their legal obligations. For Private Sales: use UKMarketStore's dispute process if there is a problem with the item, such as the item being materially not as described or another issue covered by the seller's legal obligations or UKMarketStore's Buyer Protection. The platform's dispute deadlines do not remove or limit any statutory rights that apply.`,
  },
  {
    title: "3. Refund Timeline",
    content: `For a statutory cancellation by a consumer buying from a business seller, the seller must provide the refund within the period required by law. For goods, this will generally be within 14 days of receiving the returned goods or evidence that they have been sent back, subject to the applicable rules. Refunds are normally made using the original payment method. UKMarketStore may facilitate the refund through its payment system where appropriate.`,
  },
  {
    title: "4. Returning the Item",
    content: `For a statutory cancellation by a consumer buying from a business seller, the consumer will generally pay the direct cost of returning the goods unless the seller has agreed to pay it or failed to provide the required information about return costs. Different rules can apply where goods are faulty, not as described or otherwise breach the seller's legal obligations. UKMarketStore may provide an additional platform refund where a seller fails to dispatch in accordance with the marketplace rules.`,
  },
  {
    title: "5. Items That Cannot Be Returned",
    content: `The right to cancel does not apply to: personalised or custom-made items, sealed goods that have been unsealed after delivery (such as cosmetics, food, or software), items that by their nature cannot be returned (such as perishable goods), or items that have been damaged or altered after delivery. This is in addition to your statutory rights if goods are faulty or not as described.`,
  },
  {
    title: "6. Faulty or Misdescribed Items",
    content: `If an item is faulty, not as described or otherwise fails to meet the seller's legal obligations, the consumer may have statutory remedies. The appropriate remedy depends on the circumstances and can include repair, replacement, price reduction or rejection/refund. Please report problems promptly through UKMarketStore so we can investigate. Any UKMarketStore dispute deadline is an internal platform process and does not remove statutory rights.`,
  },
  {
    title: "7. Seller Responsibilities",
    content: `Sellers must comply with UK consumer law and accept valid cancellations and returns. Sellers who repeatedly refuse valid returns may be suspended from UKMarketStore. The platform retains escrowed funds until a transaction is resolved to protect buyers.`,
  },
  {
    title: "8. Contact Us",
    content: `If you have any questions about returns or cancellations, please contact us at support@ukmarketstore.co.uk and include your order number and details of the issue.`,
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