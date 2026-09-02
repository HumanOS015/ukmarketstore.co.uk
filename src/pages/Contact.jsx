import { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Mail, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { withTimeout } from "@/lib/withTimeout";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sending, setSending] = useState(false);

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setSending(true);
    try {
      await withTimeout(
        base44.integrations.Core.SendEmail({
          to: "support@ukmarket.base44.app",
          subject: `Contact form message from ${form.name}`,
          body: `From: ${form.name} <${form.email}>\n\n${form.message}`,
        }),
        30000,
        "Sending message"
      );
      toast.success("Message sent — we'll be in touch soon.");
      setForm({ name: "", email: "", message: "" });
    } catch {
      toast.error("Something went wrong. Please email us directly.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 md:pl-20 py-6">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <h1 className="text-3xl font-bold tracking-tight mb-2">Contact Us</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Questions about a listing, an order, or buyer protection? Send us a message and we'll respond as soon as we can.
      </p>

      <div className="rounded-2xl border border-border bg-card p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Email us directly</p>
            <p className="text-xs text-muted-foreground">support@ukmarket.base44.app</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name" className="text-sm font-medium">Your Name</Label>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Jane Smith"
            className="mt-1.5 h-11 rounded-xl"
          />
        </div>
        <div>
          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="you@example.com"
            className="mt-1.5 h-11 rounded-xl"
          />
        </div>
        <div>
          <Label htmlFor="message" className="text-sm font-medium">Message</Label>
          <Textarea
            id="message"
            required
            value={form.message}
            onChange={(e) => update("message", e.target.value)}
            placeholder="How can we help?"
            className="mt-1.5 rounded-xl min-h-[120px]"
          />
        </div>
        <Button type="submit" disabled={sending} className="w-full h-12 rounded-xl font-semibold">
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <>
              <MessageSquare className="w-4 h-4" />
              Send Message
            </>
          )}
        </Button>
      </form>
    </div>
  );
}