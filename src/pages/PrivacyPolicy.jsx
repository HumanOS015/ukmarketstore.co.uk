import { useNavigate } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  const sections = [
    {
      title: "Data We Collect",
      body: "When you create an account we store your name and email address. When you list an item we store the product details and your email as the seller. When you buy an item we store your delivery address and a record of the order. When you sell an item we store the order details and the tracking number you provide.",
    },
    {
      title: "How We Use Your Data",
      body: "We use your data to process listings, handle orders, send you order updates (such as shipping and delivery confirmations), provide buyer protection, and comply with UK law. We never share your delivery address with anyone other than the seller of that specific item.",
    },
    {
      title: "Cookies",
      body: "We use essential cookies to keep you signed in and to remember your cookie preference. We do not use cookies for advertising or cross-site tracking.",
    },
    {
      title: "Data Retention",
      body: "We keep your order records for as long as needed to provide buyer protection and to comply with legal and tax requirements. You may request deletion of your account and personal data at any time.",
    },
    {
      title: "Your Rights",
      body: "Under UK GDPR you have the right to access, correct, or delete your personal data, and to object to its processing. To exercise any of these rights, contact us through the app.",
    },
    {
      title: "Security",
      body: "All payments are processed by our payment provider and we never store your card details. Your password is never visible to us. Delivery addresses are only shared with the seller of the relevant item.",
    },
    {
      title: "Contact",
      body: "If you have any questions about how we handle your data, please contact the UKMarketStore team through the app.",
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">How UKMarketStore handles your data</p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-6">
        Last updated: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      <div className="space-y-5">
        {sections.map((s, i) => (
          <div key={i}>
            <h2 className="text-sm font-semibold mb-1.5">{s.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}