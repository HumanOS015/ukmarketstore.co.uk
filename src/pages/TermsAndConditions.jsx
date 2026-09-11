import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

const sections = [
  {
    title: "1. Introduction",
    content: `Welcome to UKMarketStore ("we", "our", "us"). By accessing or using our platform, you agree to be bound by these Terms and Conditions. Please read them carefully before using our services. If you do not agree, you must not use UKMarketStore.`,
  },
  {
    title: "2. Eligibility",
    content: `You must be at least 18 years of age and a resident of the United Kingdom to use UKMarketStore. By creating an account, you confirm that you meet these requirements and that the information you provide is accurate and up to date.`,
  },
  {
    title: "3. Buying & Selling",
    content: `Sellers are responsible for accurately describing their items, including condition, postcode, and images. Buyers agree to purchase in good faith. Once a purchase is confirmed, it creates a binding agreement between buyer and seller. UKMarketStore acts solely as an intermediary platform facilitating the transaction and holding buyer funds in escrow until delivery is confirmed.`,
  },
  {
    title: "4. Commission & Fees",
    content: `UKMarketStore charges a 10% commission on every completed sale. This fee is automatically deducted from the seller's payout. The seller's net payout (90% of the sale price) will be transferred after the buyer confirms delivery. There are no fees for listing items or browsing the platform.`,
  },
  {
    title: "5. Buyer Protection & Escrow Automation all buyer payments are held securely in escrow via stripe connect. The 48-hour disput window is strickly automated based on logistics data:",
    content: `Automated Timer: the 48-hour dispute window begins the exact minute the integrated UK carrier (e.g., Royal Mail, Evri, DPD) updates the tracking status to "Delivered." Releasing Funds: If a buyer does not click "Confirm Delivery" or manually "Reaise a Dispute" within 48-hours of that carrier dilivery timestamp, the stripe escrow system will automatically close the transaction and release the funds (minus our 10% commission) to the seller. Lost Parcels: If a tracking number does not show a "delivered" status within the estimated delivery window, the buyer can open a dispute for non-delivery to hold the automated release of fund. `,
  },
  {
    title: "6. Prohibited Items",
    content: `You must not list or sell: illegal items, counterfeit goods, hazardous materials, weapons, controlled substances, or any items prohibited under UK law. Any listings containing prohibited or dangerous items will be automatically removed from the platform. UKMarketStore reserves the right to suspend any account found in violation of this policy.`,
  },
  {
    title: "7. User Conduct",
    content: `You agree not to misuse the platform, attempt to defraud other users, post false or misleading information, harass or abuse other users, or attempt to circumvent our payment system by transacting off-platform. Violations may result in immediate account suspension.`,
  },
  {
    title: "8. Intellectual Property",
    content: `All content on UKMarketStore, including logos, design, and software, is owned by UKMarketStore and protected by UK intellectual property law. By listing items, you grant UKMarketStore a non-exclusive licence to display your listing content on the platform.`,
  },
  {
    title: "9. Limitation of Liability",
    content: `UKMarketStore is a platform provider and is not liable for item conditions, accuracy of listings, or disputes arising from the quality of goods. However, we will issue a full refund to the buyer if the seller fails to dispatch the item or provide a valid UK tracking number within 3 business days of sale. Our total liability is otherwise limited to the commission amount collected on the relevant transaction.`,
  },
  {
    title: "10. Privacy",
    content: `Your use of UKMarketStore is also governed by our Privacy Policy. We collect and process personal data in accordance with UK GDPR. We do not sell your personal information to third parties.`,
  },
  {
    title: "11. Changes to Terms",
    content: `We reserve the right to update these Terms and Conditions at any time. We will notify users of significant changes via email or an in-app notice. Continued use of UKMarketStore after changes constitutes acceptance of the revised terms.`,
  },
  {
    title: "12. Governing Law",
    content: `These Terms and Conditions are governed by the laws of England and Wales. Any disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.`,
  },
];

export default function TermsAndConditions() {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-6">
      {/* Back */}
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
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Terms & Conditions</h1>
          <p className="text-sm text-muted-foreground">Last updated: 1 April 2026</p>
        </div>
      </div>

      {/* Intro banner */}
      <div className="mt-6 p-4 rounded-2xl bg-primary/5 border border-primary/10">
        <p className="text-sm leading-relaxed text-muted-foreground">
        These Terms and Conditions govern your use of UKMarketStore. By using our platform,
        you agree to comply with and be bound by the following terms. Please read
        carefully before buying or selling.
        </p>
      </div>

      {/* Sections */}
      <div className="mt-8 space-y-6">
        {sections.map((section, i) => (
          <div key={i}>
            <h2 className="text-base font-semibold mb-2">{section.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
          </div>
        ))}
      </div>

      {/* Contact */}
      <div className="mt-10 p-4 rounded-2xl bg-muted/50 border border-border text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Contact Us</p>
        <p>If you have any questions about these Terms and Conditions, please contact us at{" "}
          <a href="mailto:ukmarketstore@hotmail.com" className="text-primary hover:underline">
            ukmarketstore@hotmail.com
          </a>.
        </p>
      </div>
    </div>
  );
}