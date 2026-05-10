import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { uploadFile } from "@/lib/upload";
import { InstituteType, InstituteTier, Country, District, Province } from "@/lib/enums";
import { Loader2, Upload, X, Globe, CheckCircle, XCircle, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TIER_LABELS: Record<string, { label: string; description: string; color: string }> = {
  FREE: { label: "Free", description: "Basic features, no custom domain", color: "bg-gray-100 text-gray-700" },
  STARTER: { label: "Starter", description: "Subdomain (e.g., abc.suraksha.lk)", color: "bg-blue-100 text-blue-700" },
  PROFESSIONAL: { label: "Professional", description: "Advanced branding + video backgrounds", color: "bg-purple-100 text-purple-700" },
  ENTERPRISE: { label: "Enterprise", description: "Custom domain + full branding", color: "bg-orange-100 text-orange-700" },
  ISOLATED: { label: "Isolated", description: "Fully isolated infrastructure", color: "bg-red-100 text-red-700" },
};

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  shortName: z.string().min(1, "Short name is required"),
  code: z.string().min(1, "Code is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  country: z.string().min(1, "Country is required"),
  district: z.string().min(1, "District is required"),
  province: z.string().min(1, "Province is required"),
  pinCode: z.string().min(1, "Pin code is required"),
  type: z.string().min(1, "Type is required"),
  tier: z.string().optional(),
  subdomain: z.string()
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Lowercase letters, numbers, and hyphens only")
    .min(3, "Min 3 characters")
    .max(63, "Max 63 characters")
    .optional()
    .or(z.literal("")),
  primaryColorCode: z.string().optional(),
  secondaryColorCode: z.string().optional(),
  isDefault: z.boolean().default(false),
  vision: z.string().optional(),
  mission: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  facebookPageUrl: z.string().url().optional().or(z.literal("")),
  youtubeChannelUrl: z.string().url().optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

interface CreateInstituteFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateInstituteForm({
  open,
  onOpenChange,
  onSuccess,
}: CreateInstituteFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [subdomainAvailable, setSubdomainAvailable] = useState<boolean | null>(null);
  const [checkingSubdomain, setCheckingSubdomain] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      shortName: "",
      code: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      country: Country.SRI_LANKA,
      district: "",
      province: "",
      pinCode: "",
      type: InstituteType.SCHOOL,
      tier: InstituteTier.FREE,
      subdomain: "",
      primaryColorCode: "#4CAF50",
      secondaryColorCode: "#E91E63",
      isDefault: false,
      vision: "",
      mission: "",
      websiteUrl: "",
      facebookPageUrl: "",
      youtubeChannelUrl: "",
    },
  });

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "logo" | "image"
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (type === "logo") {
          setLogoFile(file);
          setLogoPreview(reader.result as string);
        } else {
          setImageFile(file);
          setImagePreview(reader.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = (type: "logo" | "image") => {
    if (type === "logo") {
      setLogoFile(null);
      setLogoPreview(null);
    } else {
      setImageFile(null);
      setImagePreview(null);
    }
  };

  const checkSubdomainAvailability = async () => {
    const subdomain = form.getValues("subdomain");
    if (!subdomain || subdomain.length < 3) return;
    setCheckingSubdomain(true);
    try {
      const res = await api.checkSubdomainAvailability(subdomain.trim().toLowerCase());
      setSubdomainAvailable(res.available);
    } catch {
      toast({ title: "Error", description: "Failed to check subdomain availability", variant: "destructive" });
    } finally {
      setCheckingSubdomain(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      let logoUrl = "";
      let imageUrl = "";

      // Upload logo if selected
      if (logoFile) {
        const logoResult = await uploadFile(logoFile, "institute-images");
        logoUrl = logoResult.relativePath;
      }

      // Upload image if selected
      if (imageFile) {
        const imageResult = await uploadFile(imageFile, "institute-images");
        imageUrl = imageResult.relativePath;
      }

      const payload = {
        ...data,
        logoUrl: logoUrl || undefined,
        imageUrl: imageUrl || undefined,
        tier: data.tier || undefined,
        subdomain: data.subdomain || undefined,
        // Remove empty URL strings - API requires valid URLs or undefined
        websiteUrl: data.websiteUrl || undefined,
        facebookPageUrl: data.facebookPageUrl || undefined,
        youtubeChannelUrl: data.youtubeChannelUrl || undefined,
      };

      await api.createInstitute(payload);

      toast({
        title: "Success",
        description: "Institute created successfully",
      });

      form.reset();
      setLogoFile(null);
      setImageFile(null);
      setLogoPreview(null);
      setImagePreview(null);
      setSubdomainAvailable(null);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Failed to create institute:", error);
      toast({
        title: "Error",
        description: "Failed to create institute",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create Institute</DialogTitle>
        </DialogHeader>
        <div className="max-h-[75vh] overflow-y-auto pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Institute name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shortName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Short Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Short name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="Institute code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(InstituteType).map(([key, value]) => (
                            <SelectItem key={key} value={value}>
                              {key.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Package / Tier Selection */}
              <div className="rounded-lg border p-4 space-y-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Package & Domain
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Package Tier</FormLabel>
                        <Select onValueChange={(v) => { field.onChange(v); setSubdomainAvailable(null); }} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select package" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(InstituteTier).map(([key, value]) => (
                              <SelectItem key={key} value={value}>
                                <div className="flex flex-col">
                                  <span>{TIER_LABELS[key]?.label || key}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {TIER_LABELS[key]?.description}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {form.watch("tier") && form.watch("tier") !== InstituteTier.FREE && (
                    <FormField
                      control={form.control}
                      name="subdomain"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Subdomain</FormLabel>
                          <FormControl>
                            <div className="flex items-center gap-1">
                              <Input
                                placeholder="academy"
                                {...field}
                                className="flex-1"
                                onChange={(e) => {
                                  field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                                  setSubdomainAvailable(null);
                                }}
                              />
                              <span className="text-sm text-muted-foreground whitespace-nowrap">
                                .suraksha.lk
                              </span>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={checkSubdomainAvailability}
                                disabled={checkingSubdomain || !field.value || field.value.length < 3}
                              >
                                {checkingSubdomain ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                              </Button>
                            </div>
                          </FormControl>
                          {subdomainAvailable !== null && (
                            <p className={`text-xs flex items-center gap-1 ${subdomainAvailable ? "text-green-600" : "text-destructive"}`}>
                              {subdomainAvailable ? <><CheckCircle className="h-3 w-3" /> Available</> : <><XCircle className="h-3 w-3" /> Taken or reserved</>}
                            </p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                {form.watch("tier") === InstituteTier.FREE && (
                  <p className="text-xs text-amber-600">
                    Subdomains and custom login require STARTER tier or above.
                  </p>
                )}
                {form.watch("tier") && form.watch("tier") !== InstituteTier.FREE && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 space-y-1">
                    <p className="font-medium flex items-center gap-1">
                      <Badge className={TIER_LABELS[form.watch("tier") || "FREE"]?.color || ""}>
                        {TIER_LABELS[form.watch("tier") || "FREE"]?.label}
                      </Badge>
                    </p>
                    <p>{TIER_LABELS[form.watch("tier") || "FREE"]?.description}</p>
                    {(form.watch("tier") === InstituteTier.ENTERPRISE || form.watch("tier") === InstituteTier.ISOLATED) && (
                      <p className="text-orange-600">Custom domain can be set after creation via Tenant Management.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="Email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone *</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Address */}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Full address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City *</FormLabel>
                      <FormControl>
                        <Input placeholder="City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>State *</FormLabel>
                      <FormControl>
                        <Input placeholder="State" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="pinCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pin Code *</FormLabel>
                      <FormControl>
                        <Input placeholder="Pin code" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Country *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select country" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(Country).map(([key, value]) => (
                            <SelectItem key={key} value={value}>
                              {value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>District *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select district" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(District).map(([key, value]) => (
                            <SelectItem key={key} value={value}>
                              {key.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="province"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Province *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select province" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(Province).map(([key, value]) => (
                            <SelectItem key={key} value={value}>
                              {key.replace(/_/g, " ")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Colors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="primaryColorCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" className="w-14 h-10 p-1" {...field} />
                          <Input placeholder="#4CAF50" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="secondaryColorCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Color</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input type="color" className="w-14 h-10 p-1" {...field} />
                          <Input placeholder="#E91E63" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Vision & Mission */}
              <FormField
                control={form.control}
                name="vision"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vision</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Institute vision" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mission"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mission</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Institute mission" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* URLs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="websiteUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="facebookPageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Facebook URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://facebook.com/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="youtubeChannelUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>YouTube URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://youtube.com/..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* File Uploads */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <FormLabel>Logo Image</FormLabel>
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    {logoPreview ? (
                      <div className="relative">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-full h-32 object-contain rounded"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-0 right-0"
                          onClick={() => removeFile("logo")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center cursor-pointer">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground mt-2">
                          Click to upload logo
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileChange(e, "logo")}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <FormLabel>Cover Image</FormLabel>
                  <div className="border-2 border-dashed border-border rounded-lg p-4">
                    {imagePreview ? (
                      <div className="relative">
                        <img
                          src={imagePreview}
                          alt="Image preview"
                          className="w-full h-32 object-cover rounded"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-0 right-0"
                          onClick={() => removeFile("image")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center cursor-pointer">
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground mt-2">
                          Click to upload image
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileChange(e, "image")}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Is Default */}
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Set as Default</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Make this the default institute
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Institute
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
