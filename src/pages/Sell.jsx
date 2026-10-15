import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, PoundSterling, CheckCircle2, X, ArrowLeft, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { withTimeout } from "@/lib/withTimeout";
import PayoutConnect from "@/components/PayoutConnect";
import VariationEditor from "@/components/product/VariationEditor";

const CATEGORIES = [
  "Electronics", "Fashion", "Home & Garden", "Sports", "Toys",
  "Motors", "Books", "Music", "Collectibles", "Health & Beauty", "Pet Supplies", "Other",
];

const CONDITIONS = ["New", "Used - Like New", "Used - Fair"];
const DELIVERY_TIMES = ["1-2 days", "3-5 days", "5-7 days", "1-2 weeks", "2+ weeks"];

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

export default function Sell() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const [editProduct, setEditProduct] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [additionalImages, setAdditionalImages] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    condition: "",
    postcode: "",
    fulfilment_method: "Tracked UK Delivery",
    estimated_delivery: "",
    quantity: "1",
    size_enabled: false,
    size_type: "clothing",
    sizes: [],
    colour_enabled: false,
    colours: [],
  });
  const [payoutReady, setPayoutReady] = useState(null); // null = checking, false = not connected, true = connected
  const [businessType, setBusinessType] = useState("individual");
  const [pendingProduct, setPendingProduct] = useState(null);
  const [stripeConnectUrl, setStripeConnectUrl] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const checkPayout = async () => {
      try {
        const me = await base44.auth.me();
        if (!me?.email) {
          base44.auth.redirectToLogin(window.location.href);
          return;
        }
        setCurrentUser(me);
        if (searchParams.get("stripe_connect") === "return") {
          const stripeResult = await withTimeout(
            base44.functions.invoke("createConnectAccount", {}),
            20000,
            "Verifying Stripe setup"
          );
          const accounts = await base44.entities.PayoutAccount.filter({ seller_email: me.email });
          const ready = accounts[0]?.charges_enabled === true;
          setPayoutReady(ready);
          if (stripeResult.data?.onboarded && ready) {
            setSuccess(true);
          } else {
            toast.error("Stripe setup is not complete yet. Your listing is saved; finish the required steps in Stripe to publish it.");
          }
          return;
        }
        if (editId) {
          const result = await base44.entities.Product.filter({ id: editId }, "-created_date", 1);
          const product = Array.isArray(result) ? result[0] : result?.items?.[0];
          if (!product || product.seller_email?.toLowerCase() !== me.email?.toLowerCase()) {
            toast.error("You can only edit your own listings.");
            navigate("/profile");
            return;
          }
          setEditProduct(product);
          setForm({
            title: product.title || "",
            description: product.description || "",
            price: product.price == null ? "" : String(product.price),
            category: product.category || "",
            condition: product.condition || "",
            postcode: product.postcode || "",
            fulfilment_method: product.fulfilment_method || "Tracked UK Delivery",
            estimated_delivery: product.estimated_delivery || "",
            quantity: String(product.quantity ?? product.available_quantity ?? 1),
            size_enabled: Boolean(product.size_enabled),
            size_type: product.size_type || "clothing",
            sizes: Array.isArray(product.sizes) ? product.sizes : [],
            colour_enabled: Boolean(product.colour_enabled),
            colours: Array.isArray(product.colours) ? product.colours : [],
          });
          setImageUrl(product.image_url || "");
          setAdditionalImages(Array.isArray(product.additional_images) ? product.additional_images.slice(0, 6) : []);
          setPayoutReady(true);
          return;
        }
        const accounts = await base44.entities.PayoutAccount.filter({ seller_email: me.email });
        setPayoutReady(accounts[0]?.charges_enabled === true);
      } catch (err) {
        console.error("Payout check failed", err);
        setPayoutReady(false);
      }
    };
    checkPayout();
  }, [editId, navigate, searchParams]);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!imageUrl) {
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
    } else if (additionalImages.length < 6) {
      setUploading(true);
      try {
        const { file_url } = await withTimeout(
          base44.integrations.Core.UploadFile({ file }),
          30000,
          "Uploading image"
        );
        setAdditionalImages((prev) => [...prev, file_url]);
      } catch (err) {
        console.error("Image upload failed", err);
        toast.error("Image upload failed. Please try again.");
      } finally {
        setUploading(false);
      }
    } else {
      toast.error("You can upload up to 7 images");
    }
    e.target.value = "";
  };

  const removeAdditionalImage = (index) => {
    setAdditionalImages((prev) => prev.filter((_, i) => i !== index));
  };

  const removeMainImage = () => {
    if (additionalImages.length > 0) {
      setImageUrl(additionalImages[0]);
      setAdditionalImages((prev) => prev.slice(1));
    } else {
      setImageUrl("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim()) {
      toast.error("Please enter a listing title");
      document.getElementById("title")?.focus();
      return;
    }
    const price = Number(form.price);
    if (!form.price || !Number.isFinite(price) || price <= 0) {
      toast.error("Please enter a valid price greater than £0.00");
      document.getElementById("price")?.focus();
      return;
    }
    if (!imageUrl) {
      toast.error("Please upload a product image");
      return;
    }
    if (additionalImages.length > 6) {
      toast.error("You can upload up to 7 images total");
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

    // Open a tab synchronously from the user's tap so Stripe can navigate there
    // after the account-link request completes, even inside the Base44 preview iframe.
    const stripeWindow = !editId && !payoutReady ? window.open("about:blank", "_blank") : null;

    setLoading(true);
    try {
      const user = await withTimeout(base44.auth.me(), 15000, "Verifying account");
      if (editId) {
        if (!editProduct || editProduct.seller_email?.toLowerCase() !== user.email?.toLowerCase()) {
          toast.error("You can only edit your own listings.");
          navigate("/profile");
          return;
        }
        const updates = {
          title: form.title.trim(),
          description: form.description.trim(),
          price: parseFloat(form.price),
          category: form.category,
          condition: form.condition,
          fulfilment_method: "Tracked UK Delivery",
          estimated_delivery: form.estimated_delivery || null,
          postcode: form.postcode.trim().toUpperCase(),
          image_url: imageUrl,
          additional_images: additionalImages,
          quantity: parseInt(form.quantity) || 1,
          size_enabled: form.size_enabled,
          size_type: form.size_enabled ? form.size_type : null,
          sizes: form.size_enabled ? form.sizes : [],
          colour_enabled: form.colour_enabled,
          colours: form.colour_enabled ? form.colours : [],
        };
        await withTimeout(base44.entities.Product.update(editId, updates), 15000, "Updating listing");
        toast.success("Listing updated successfully");
        navigate("/profile");
        return;
      }
      const createdProduct = await withTimeout(
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
          additional_images: additionalImages,
          seller_email: user.email,
          seller_name: user.display_name || user.full_name || user.email,
          status: payoutReady ? "active" : "pending_stripe",
          quantity: parseInt(form.quantity) || 1,
          available_quantity: parseInt(form.quantity) || 1,
          size_enabled: form.size_enabled,
          size_type: form.size_enabled ? form.size_type : null,
          sizes: form.size_enabled ? form.sizes : [],
          colour_enabled: form.colour_enabled,
          colours: form.colour_enabled ? form.colours : [],
        }),
        15000,
        "Saving listing"
      );
      if (payoutReady) {
        setSuccess(true);
      } else {
        setPendingProduct(createdProduct);
        const stripeResult = await withTimeout(
          base44.functions.invoke("createConnectAccount", { businessType }),
          20000,
          "Preparing Stripe"
        );
        if (stripeResult.data?.url) {
          if (stripeWindow && !stripeWindow.closed) {
            stripeWindow.location.href = stripeResult.data.url;
          } else if (window.self === window.top) {
            window.location.href = stripeResult.data.url;
          } else {
            setStripeConnectUrl(stripeResult.data.url);
            toast.info("Your listing is saved. Tap Continue to Stripe to finish setup.");
          }
        } else {
          if (stripeWindow && !stripeWindow.closed) stripeWindow.close();
          toast.error("Your listing is saved, but Stripe setup could not be opened. Use the Connect Stripe button below to try again.");
        }
      }
    } catch (err) {
      if (stripeWindow && !stripeWindow.closed) stripeWindow.close();
      console.error("Failed to create listing", err);
      if (err?.status === 401 || err?.status === 403) {
        toast.error("Your session expired. Please sign in again.");
      } else {
        const message = err?.response?.data?.error || err?.data?.error;
        toast.error(message || "Couldn't post your listing. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  if (payoutReady === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }


  if (pendingProduct) {
    return (
      <div className="max-w-lg mx-auto px-4 md:pl-20 py-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <CreditCard className="w-10 h-10 text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Your listing is saved</h2>
        <p className="text-muted-foreground mb-2">Your item has been saved successfully.</p>
        <p className="text-sm text-muted-foreground mb-6 max-w-md">To make your listing live and receive payments, connect Stripe. Your listing will remain saved while you complete the secure payout setup.</p>
        <div className="w-full max-w-md mb-4">
          {stripeConnectUrl ? (
            <Button asChild className="w-full rounded-xl">
              <a href={stripeConnectUrl} target="_top" rel="noopener noreferrer">Continue to Stripe</a>
            </Button>
          ) : (
            <PayoutConnect user={currentUser} />
          )}
        </div>
        <Button variant="outline" className="rounded-xl" onClick={() => navigate("/profile")}>View My Listings</Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 md:pl-20 py-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Ad Posted!</h2>
        <p className="text-muted-foreground mb-6">Your listing is now live and visible to buyers across the UK.</p>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl" onClick={() => { setSuccess(false); setForm({ title: "", description: "", price: "", category: "", condition: "", postcode: "", fulfilment_method: "Tracked UK Delivery", estimated_delivery: "", quantity: "1", size_enabled: false, size_type: "clothing", sizes: [], colour_enabled: false, colours: [] }); setImageUrl(""); setAdditionalImages([]); }}>
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
      <h1 className="text-2xl font-bold tracking-tight mb-1">{editId ? "Edit Listing" : "Create Listing"}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {editId ? "Update the details of your listing" : "List your item for sale across the UK"}
      </p>

      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        {/* Image Upload */}
        <div>
          <Label className="text-sm font-medium mb-2 block">
            Product Images <span className="text-muted-foreground font-normal">(up to 7)</span>
          </Label>

          {/* Main image */}
          {imageUrl ? (
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border mb-3">
              <img src={imageUrl} alt="Main image" className="w-full h-full object-cover" />
              <div className="absolute top-2 left-2">
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">Main</span>
              </div>
              <button
                type="button"
                onClick={removeMainImage}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-foreground/70 text-white flex items-center justify-center hover:bg-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label className="cursor-pointer block aspect-square rounded-2xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex flex-col items-center justify-center bg-muted/50">
              {uploading ? (
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              ) : (
                <>
                  <Camera className="w-10 h-10 text-muted-foreground/50 mb-2" />
                  <span className="text-sm text-muted-foreground">Tap to upload main image</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          )}

          {/* Additional image thumbnails */}
          {imageUrl && (
            <div className="flex gap-2 flex-wrap">
              {additionalImages.map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden bg-muted border border-border shrink-0">
                  <img src={url} alt={`Extra ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeAdditionalImage(i)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-foreground/70 text-white flex items-center justify-center hover:bg-foreground transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {additionalImages.length < 6 && (
                <label className="w-20 h-20 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors flex items-center justify-center bg-muted/50 shrink-0 cursor-pointer">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  ) : (
                    <Camera className="w-5 h-5 text-muted-foreground/50" />
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
              )}
            </div>
          )}
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

        {/* Quantity */}
        <div>
          <Label htmlFor="quantity" className="text-sm font-medium">Quantity available</Label>
          <Input
            id="quantity"
            type="number"
            min="1"
            step="1"
            placeholder="1"
            value={form.quantity}
            onChange={(e) => update("quantity", e.target.value)}
            className="mt-1.5 h-11 rounded-xl"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            How many of this item do you have? Buyers can purchase up to this amount.
          </p>
        </div>

        {/* Category & Condition */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium">Category</Label>
            <select
              aria-label="Category"
              value={form.category}
              onChange={(e) => update("category", e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">Select</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-sm font-medium">Condition</Label>
            <select
              aria-label="Condition"
              value={form.condition}
              onChange={(e) => update("condition", e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">Select</option>
              {CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>{condition}</option>
              ))}
            </select>
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
          <select
            aria-label="Estimated Delivery Time"
            value={form.estimated_delivery}
            onChange={(e) => update("estimated_delivery", e.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="">Select delivery time</option>
            {DELIVERY_TIMES.map((deliveryTime) => (
              <option key={deliveryTime} value={deliveryTime}>{deliveryTime}</option>
            ))}
          </select>
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

        {/* Variations */}
        <VariationEditor form={form} update={update} />

        {!editId && !payoutReady && (
          <div>
            <Label htmlFor="stripe-seller-type" className="text-sm font-medium">Seller type for Stripe</Label>
            <select
              id="stripe-seller-type"
              value={businessType}
              onChange={(e) => {setBusinessType(e.target.value);setConnectUrl(null);}}
              className="mt-1.5 h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="individual">Individual seller</option>
              <option value="company">Business seller</option>
            </select>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-xl text-base font-semibold"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            editId ? "Save Listing Changes" : "List Item for Sale"
          )}
        </Button>
      </form>
    </div>
  );
}