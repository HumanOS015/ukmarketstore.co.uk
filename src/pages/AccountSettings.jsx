import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail, Save, UserRound, Loader2, Phone, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/AuthContext";

const MAX_PROFILE_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/avif"]);
const SUPPORTED_IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

export default function AccountSettings() {
  const { navigateToLogin } = useAuth();
  const fileInputRef = useRef(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [profileImages, setProfileImages] = useState([]);
  const [sellerType, setSellerType] = useState("individual");
  const [individualPublicDetails, setIndividualPublicDetails] = useState("");
  const [individualDetailsPublic, setIndividualDetailsPublic] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessContactEmail, setBusinessContactEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState("");
  const [businessVatNumber, setBusinessVatNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const loadAccount = async () => {
      try {
        const currentUser = await base44.auth.me();
        if (!active) return;
        setDisplayName(currentUser?.display_name || currentUser?.full_name || "");
        setPhone(currentUser?.phone || "");
        setEmail(currentUser?.email || "");
        setProfileImages(Array.isArray(currentUser?.profile_images) ? currentUser.profile_images.slice(0, MAX_PROFILE_IMAGES) : []);
        setSellerType(currentUser?.seller_type === "business" ? "business" : "individual");
        setIndividualPublicDetails(currentUser?.individual_public_details || "");
        setIndividualDetailsPublic(currentUser?.individual_details_public === true);
        setBusinessName(currentUser?.business_name || "");
        setBusinessAddress(currentUser?.business_address || "");
        setBusinessContactEmail(currentUser?.business_contact_email || "");
        setBusinessPhone(currentUser?.business_phone || "");
        setBusinessRegistrationNumber(currentUser?.business_registration_number || "");
        setBusinessVatNumber(currentUser?.business_vat_number || "");
      } catch (error) {
        console.error("Failed to load account settings", error);
        if (error?.status === 401 || error?.status === 403) {
          navigateToLogin();
          return;
        }
        toast.error("Couldn't load your account details. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadAccount();
    return () => { active = false; };
  }, []);

  const handleImageSelection = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const slots = MAX_PROFILE_IMAGES - profileImages.length;
    if (slots <= 0) {
      toast.error("You can add up to 5 profile images.");
      return;
    }

    const selectedFiles = files.slice(0, slots);
    if (files.length > slots) {
      toast.message("Only the first " + slots + " image(s) will be uploaded to keep your profile within the 5-image limit.");
    }

    const validFiles = [];
    for (const file of selectedFiles) {
      // Some Windows browsers report an empty MIME type for valid image files,
      // so also check the filename extension instead of rejecting those files.
      const isSupportedImage = SUPPORTED_IMAGE_TYPES.has((file.type || "").toLowerCase()) ||
        (!file.type && SUPPORTED_IMAGE_EXTENSIONS.test(file.name));
      if (!isSupportedImage) {
        toast.error(file.name + " is not a supported image. Choose JPG, PNG, WebP, GIF, BMP or AVIF.");
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(file.name + " is over 5 MB. Choose a smaller image.");
        continue;
      }
      validFiles.push(file);
    }
    if (!validFiles.length) return;

    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of validFiles) {
        const result = await base44.integrations.Core.UploadFile({ file });
        if (result?.file_url) uploadedUrls.push(result.file_url);
        else throw new Error("The upload did not return an image URL.");
      }
      setProfileImages((current) => [...current, ...uploadedUrls].slice(0, MAX_PROFILE_IMAGES));
      toast.success(uploadedUrls.length === 1 ? "Profile image uploaded. Save changes to keep it." : uploadedUrls.length + " profile images uploaded. Save changes to keep them.");
    } catch (error) {
      console.error("Profile image upload failed", error);
      toast.error("Couldn't upload the profile image(s). Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const removeProfileImage = (index) => {
    setProfileImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const cleanedName = displayName.trim();
    if (!cleanedName) {
      toast.error("Please enter a display name.");
      return;
    }
    if (profileImages.length > MAX_PROFILE_IMAGES) {
      toast.error("You can save up to 5 profile images.");
      return;
    }
    setSaving(true);
    try {
      const updatedUser = await base44.auth.updateMe({
        display_name: cleanedName,
        phone: phone.trim(),
        profile_images: profileImages,
        seller_type: sellerType,
        individual_public_details: individualPublicDetails.trim(),
        individual_details_public: sellerType === "individual" && individualDetailsPublic,
        business_name: businessName.trim(),
        business_address: businessAddress.trim(),
        business_contact_email: businessContactEmail.trim(),
        business_phone: businessPhone.trim(),
        business_registration_number: businessRegistrationNumber.trim(),
        business_vat_number: businessVatNumber.trim()
      });
      setDisplayName(updatedUser?.display_name || cleanedName);
      setPhone(updatedUser?.phone || phone.trim());
      setProfileImages(Array.isArray(updatedUser?.profile_images) ? updatedUser.profile_images.slice(0, MAX_PROFILE_IMAGES) : profileImages);
      setIndividualDetailsPublic(updatedUser?.individual_details_public === true);
      toast.success("Account details updated successfully.");
    } catch (error) {
      console.error("Failed to update account details", error);
      toast.error("Couldn't save your account details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 md:pl-20">
      <Link to="/account" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Account
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <UserRound className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your account details and profile photos.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="rounded-2xl border border-border bg-card p-5 space-y-6">
          <div className="space-y-3">
            <div>
              <Label>Profile photos</Label>
              <p className="text-xs text-muted-foreground mt-1">Add up to 5 images to personalise your profile. Use JPG, PNG, WebP, GIF, BMP or AVIF files, 5 MB or smaller each.</p>
            </div>
            {profileImages.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {profileImages.map((imageUrl, index) => (
                  <div key={imageUrl + index} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted">
                    <img src={imageUrl} alt={"Profile photo " + (index + 1)} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeProfileImage(index)}
                      disabled={uploading || saving}
                      aria-label={"Remove profile photo " + (index + 1)}
                      className="absolute top-1 right-1 flex items-center justify-center w-7 h-7 rounded-full bg-black/70 text-white hover:bg-black disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {index === 0 && <span className="absolute bottom-0 inset-x-0 bg-black/65 text-white text-[10px] text-center py-1">Main photo</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <UserRound className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No profile photos added yet.</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelection}
              disabled={uploading || saving || profileImages.length >= MAX_PROFILE_IMAGES}
            />
            <Button
              type="button"
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || saving || profileImages.length >= MAX_PROFILE_IMAGES}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              {uploading ? "Uploading…" : "Add profile photos (" + profileImages.length + "/" + MAX_PROFILE_IMAGES + ")"}
            </Button>
            <p className="text-xs text-muted-foreground">Choose your photos, remove any you don't want, then select Save Changes. Your first photo is used as your main profile picture.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-display-name">Display name</Label>
            <Input
              id="account-display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="nickname"
              maxLength={100}
              placeholder="Enter your display name"
              required
            />
            <p className="text-xs text-muted-foreground">This name is used to identify you on UKMarketStore. Your original sign-in name is not changed.</p>
          </div>

          <div className="space-y-4 rounded-xl border border-border p-4">
            <div className="space-y-2">
              <Label htmlFor="seller-type">Seller type</Label>
              <select id="seller-type" value={sellerType} onChange={(event) => setSellerType(event.target.value)} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm">
                <option value="individual">Individual seller</option>
                <option value="business">Business seller</option>
              </select>
            </div>
            {sellerType === "individual" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="individual-public-details">Individual seller details (optional)</Label>
                  <textarea id="individual-public-details" value={individualPublicDetails} onChange={(event) => setIndividualPublicDetails(event.target.value)} maxLength={1000} rows={4} placeholder="Add details you want buyers to see" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
                  <p className="text-xs text-muted-foreground">These details are private unless you choose to show them on your storefront.</p>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={individualDetailsPublic} onChange={(event) => setIndividualDetailsPublic(event.target.checked)} className="mt-1" />
                  <span>Show my individual seller details publicly on my storefront</span>
                </label>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Business details are shown publicly on your storefront.</p>
                <div className="space-y-2"><Label htmlFor="business-name">Business name</Label><Input id="business-name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} maxLength={200} /></div>
                <div className="space-y-2"><Label htmlFor="business-address">Business address</Label><textarea id="business-address" value={businessAddress} onChange={(event) => setBusinessAddress(event.target.value)} maxLength={500} rows={3} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-2"><Label htmlFor="business-contact-email">Business contact email</Label><Input id="business-contact-email" type="email" value={businessContactEmail} onChange={(event) => setBusinessContactEmail(event.target.value)} maxLength={254} /></div>
                <div className="space-y-2"><Label htmlFor="business-phone">Business phone</Label><Input id="business-phone" type="tel" value={businessPhone} onChange={(event) => setBusinessPhone(event.target.value)} maxLength={30} /></div>
                <div className="space-y-2"><Label htmlFor="business-registration-number">Company registration number (optional)</Label><Input id="business-registration-number" value={businessRegistrationNumber} onChange={(event) => setBusinessRegistrationNumber(event.target.value)} maxLength={100} /></div>
                <div className="space-y-2"><Label htmlFor="business-vat-number">VAT number (optional)</Label><Input id="business-vat-number" value={businessVatNumber} onChange={(event) => setBusinessVatNumber(event.target.value)} maxLength={100} /></div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-phone">Phone number (optional)</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="account-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                maxLength={30}
                placeholder="Enter your phone number"
                className="pl-9"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="account-email">Sign-in email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="account-email" value={email} readOnly className="pl-9 bg-muted/40" />
            </div>
            <p className="text-xs text-muted-foreground">Your sign-in email is shown here and cannot be changed on this page.</p>
          </div>

          <Button type="submit" disabled={saving || uploading || loading} className="w-full sm:w-auto gap-2 rounded-xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      )}
    </div>
  );
}
