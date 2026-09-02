import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Loader2, PoundSterling, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { withTimeout } from "@/lib/withTimeout";

const CATEGORIES = [
  "Electronics", "Fashion", "Home & Garden", "Sports", "Toys",
  "Motors", "Books", "Music", "Collectibles", "Health & Beauty", "Pet Supplies", "Other",
];

const CONDITIONS = ["New", "Used - Like New", "Used - Fair"];
const DELIVERY_TIMES = ["1-2 days", "3-5 days", "5-7 days", "1-2 weeks", "2+ weeks"];

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export default function Sell() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    condition: "",
    postcode: "",
    fulfilment_method: "Tracked UK Delivery",
    estimated_delivery: "",
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await withTimeout(
        base44.integrations.Core.UploadFile({ file }),
        30000,
        "Uploading image"
      );
      setImageUrl(file_url);
    } catch (err) {
      console.error("Image upload failed", err);
      toast.error("Image upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!imageUrl) {
      toast.error("Please upload a product image");
      return;
    }
    if (!UK_POSTCODE_REGEX.test(form.postcode.trim())) {
      toast.error("Please enter a valid UK postcode");
      return;
    }
    if (!form.category) {
      toast.error("Please select a category");
      return;
    }
    if (!form.condition) {
      toast.error("Please select a condition");
      return;
    }
    if (!form.estimated_delivery) {
      toast.error("Please select an estimated delivery time");
      return;
    }

    setLoading(true);
    try {
      const user = await withTimeout(base44.auth.me(), 15000, "Verifying account");
      await withTimeout(
        base44.entities.Product.create({
          title: form.title.trim(),
          description: form.description.trim(),
          price: parseFloat(form.price),
          category: form.category,
          condition: form.condition,
          fulfilment_method: "Tracked UK Delivery",
          estimated_delivery: form.estimated_delivery || null,
          postcode: form.postcode.trim().toUpperCase(),
          image_url: imageUrl,
          seller_email: user.email,
          seller_name: user.full_name || user.email,
          status: "active",
        }),
        15000,
        "Publishing listing"
      );
      setSuccess(true);
    } catch (err) {
      console.error("Failed to create listing", err);
      if (err?.status === 401 || err?.status === 403) {
        toast.error("Your session expired. Please sign in again.");
      } else {
        toast.error("Couldn't post your listing. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 md:pl-20 py-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Ad Posted!</h2>
        <p className="text-muted-foreground mb-6">Your listing is now live and visible to buyers across the UK.</p>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl" onClick={() => { setSuccess(false); setForm({ title: "", description: "", price: "", category: "", condition: "", postcode: "", fulfilment_method: "Tracked UK Delivery", estimated_delivery: "" }); setImageUrl(""); }}>
            Post Another
          </Button>
          <Button className="rounded-xl" onClick={() => navigate("/")}>
            Browse Listings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 md:pl-20 py-6">
      <h1 className="text-2xl font-bold tracking-tight mb-1">Create Listing</h1>
      <p className="text-sm text-muted-foreground mb-6">
        List your item for sale across the UK
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Image Upload */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Product Image</Label>
          <label className="cursor-pointer block">
            {imageUrl ? (
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted border-2 border-dashed border-border hover:border-primary/50 transition-colors">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-foreground/0 hover:bg-foreground/10 transition-colors flex items-center justify-center">
                  <span className="text-white text-sm font-medium opacity-0 hover:opacity-100 transition-opacity">
                    Change Image
                  </span>
                </div>
              </div>
            ) : (
              <div className="aspect-square rounded-2xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center bg-muted/50">
                {uploading ? (
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                ) : (
                  <>
                    <Camera className="w-10 h-10 text-muted-foreground/50 mb-2" />
                    <span className="text-sm text-muted-foreground">Tap to upload</span>
                  </>
                )}
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        </div>

        {/* Title */}
        <div>
          <Label htmlFor="title" className="text-sm font-medium">Title</Label>
          <Input
            id="title"
            required
            placeholder="What are you selling?"
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            className="mt-1.5 h-11 rounded-xl"
          />
        </div>

        {/* Description */}
        <div>
          <Label htmlFor="desc" className="text-sm font-medium">Description</Label>
          <Textarea
            id="desc"
            placeholder="Describe your item, condition, and any details..."
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className="mt-1.5 rounded-xl min-h-[100px]"
          />
        </div>

        {/* Price */}
        <div>
          <Label htmlFor="price" className="text-sm font-medium">Price (£)</Label>
          <div className="relative mt-1.5">
            <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="price"
              type="number"
              required
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
              className="pl-10 h-11 rounded-xl"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            10% commission applies on sale (you receive £{form.price ? (parseFloat(form.price) * 0.9).toFixed(2) : "0.00"})
          </p>
        </div>

        {/* Category & Condition */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium">Category</Label>
            <Select value={form.category} onValueChange={(v) => update("category", v)}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Condition</Label>
            <Select value={form.condition} onValueChange={(v) => update("condition", v)}>
              <SelectTrigger className="mt-1.5 h-11 rounded-xl">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tracked Delivery Notice */}
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
          <p className="text-xs font-semibold text-amber-800 mb-1">📦 Tracked UK Delivery Only</p>
          <p className="text-xs text-amber-700 leading-relaxed">To protect your payment, items must be sent via tracked postage. Funds are released once delivery is confirmed.</p>
        </div>

        {/* Estimated Delivery */}
        <div>
          <Label className="text-sm font-medium">Estimated Delivery Time <span className="text-destructive">*</span></Label>
          <Select value={form.estimated_delivery} onValueChange={(v) => update("estimated_delivery", v)}>
            <SelectTrigger className="mt-1.5 h-11 rounded-xl">
              <SelectValue placeholder="Select delivery time" />
            </SelectTrigger>
            <SelectContent>
              {DELIVERY_TIMES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Postcode */}
        <div>
          <Label htmlFor="postcode" className="text-sm font-medium">UK Postcode</Label>
          <Input
            id="postcode"
            required
            placeholder="e.g. SW1A 1AA"
            value={form.postcode}
            onChange={(e) => update("postcode", e.target.value)}
            className="mt-1.5 h-11 rounded-xl uppercase"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl text-base font-semibold"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "List Item for Sale"
          )}
        </Button>
      </form>
    </div>
  );
}