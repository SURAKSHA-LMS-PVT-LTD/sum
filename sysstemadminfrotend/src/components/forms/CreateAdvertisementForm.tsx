import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { uploadFile } from "@/lib/upload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  MediaType,
  SupportivePlatform,
  Province,
  District,
  UserType,
  Gender,
  SubscriptionPlan,
  Occupation,
} from "@/lib/enums";
import { Upload, X, Search, Plus } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  accessKey: z.string().min(1, "Access key is required"),
  description: z.string().min(1, "Description is required"),
  landingUrl: z.string().url("Must be a valid URL"),
  sendingUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  supportivePlatforms: z.array(z.string()).min(1, "Select at least one platform"),
  mediaType: z.string().min(1, "Media type is required"),
  targetProvinces: z.array(z.string()).optional(),
  targetDistricts: z.array(z.string()).optional(),
  minBornYear: z.number().optional(),
  maxBornYear: z.number().optional(),
  targetGenders: z.array(z.string()).optional(),
  targetOccupations: z.array(z.string()).optional(),
  targetUserTypes: z.array(z.string()).optional(),
  targetSubscriptionPlans: z.array(z.string()).optional(),
  displayDuration: z.number().min(1, "Display duration is required"),
  priority: z.number().min(1).max(10),
  isActive: z.boolean(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  maxSendings: z.number().optional(),
  cascadeToParents: z.boolean(),
  budget: z.number().optional(),
  costPerClick: z.number().optional(),
  costPerImpression: z.number().optional(),
  createdBy: z.string().min(1, "Created by is required"),
});

type FormData = z.infer<typeof formSchema>;

interface CreateAdvertisementFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateAdvertisementForm({
  open,
  onOpenChange,
  onSuccess,
}: CreateAdvertisementFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [occupationSearch, setOccupationSearch] = useState("");

  // State for array fields with add button
  const [targetInstituteIds, setTargetInstituteIds] = useState<string[]>([]);
  const [instituteIdInput, setInstituteIdInput] = useState("");
  const [targetCities, setTargetCities] = useState<string[]>([]);
  const [cityInput, setCityInput] = useState("");

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      accessKey: "",
      description: "",
      landingUrl: "",
      sendingUrl: "",
      supportivePlatforms: [],
      mediaType: "image",
      targetProvinces: [],
      targetDistricts: [],
      minBornYear: undefined,
      maxBornYear: undefined,
      targetGenders: [],
      targetOccupations: [],
      targetUserTypes: [],
      targetSubscriptionPlans: [],
      displayDuration: 30,
      priority: 5,
      isActive: true,
      startDate: "",
      endDate: "",
      maxSendings: undefined,
      cascadeToParents: false,
      budget: undefined,
      costPerClick: undefined,
      costPerImpression: undefined,
      createdBy: "",
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  const getFolder = (_mediaType: string) => {
    // Backend validation only allows specific folder names.
    // "advertisement-images" is currently rejected, so we reuse the working folder used in other forms.
    return "institute-images";
  };

  const addInstituteId = () => {
    if (instituteIdInput.trim() && !targetInstituteIds.includes(instituteIdInput.trim())) {
      setTargetInstituteIds([...targetInstituteIds, instituteIdInput.trim()]);
      setInstituteIdInput("");
    }
  };

  const removeInstituteId = (id: string) => {
    setTargetInstituteIds(targetInstituteIds.filter((item) => item !== id));
  };

  const addCity = () => {
    if (cityInput.trim() && !targetCities.includes(cityInput.trim())) {
      setTargetCities([...targetCities, cityInput.trim()]);
      setCityInput("");
    }
  };

  const removeCity = (city: string) => {
    setTargetCities(targetCities.filter((item) => item !== city));
  };

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      let mediaUrl = "";

      // Upload file if selected
      if (selectedFile) {
        setIsUploading(true);
        const folder = getFolder(data.mediaType);
        const uploadResult = await uploadFile(selectedFile, folder);
        mediaUrl = uploadResult.relativePath;
        setIsUploading(false);
      }

      const payload = {
        title: data.title,
        accessKey: data.accessKey,
        description: data.description,
        mediaUrl,
        landingUrl: data.landingUrl,
        sendingUrl: data.sendingUrl || undefined,
        supportivePlatforms: data.supportivePlatforms,
        mediaType: data.mediaType,
        targetInstituteIds,
        targetCities,
        targetProvinces: data.targetProvinces || [],
        targetDistricts: data.targetDistricts || [],
        minBornYear: data.minBornYear,
        maxBornYear: data.maxBornYear,
        targetGenders: data.targetGenders || [],
        targetOccupations: data.targetOccupations || [],
        targetUserTypes: data.targetUserTypes || [],
        targetSubscriptionPlans: data.targetSubscriptionPlans || [],
        displayDuration: data.displayDuration,
        priority: data.priority,
        isActive: data.isActive,
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
        maxSendings: data.maxSendings,
        cascadeToParents: data.cascadeToParents,
        budget: data.budget,
        costPerClick: data.costPerClick,
        costPerImpression: data.costPerImpression,
        createdBy: data.createdBy,
      };

      await api.createAdvertisement(payload);

      toast({
        title: "Success",
        description: "Advertisement created successfully",
      });

      form.reset();
      setSelectedFile(null);
      setTargetInstituteIds([]);
      setTargetCities([]);
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Failed to create advertisement:", error);
      toast({
        title: "Error",
        description: "Failed to create advertisement",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  const filteredOccupations = Object.values(Occupation).filter((occ) =>
    occ.toLowerCase().includes(occupationSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Create Advertisement</DialogTitle>
          <DialogDescription>
            Fill in the details to create a new advertisement
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title *</FormLabel>
                        <FormControl>
                          <Input placeholder="Advertisement title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="accessKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access Key *</FormLabel>
                        <FormControl>
                          <Input placeholder="ADV-2025-XYZ123" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Advertisement description" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="landingUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Landing URL *</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/register" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sendingUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sending URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/campaign" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="createdBy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Created By *</FormLabel>
                      <FormControl>
                        <Input placeholder="User ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Media Upload */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Media</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="mediaType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Media Type *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select media type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.values(MediaType).map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormItem>
                    <FormLabel>Upload Media</FormLabel>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept={
                          form.watch("mediaType") === "image"
                            ? "image/*"
                            : form.watch("mediaType") === "video"
                            ? "video/*"
                            : form.watch("mediaType") === "audio"
                            ? "audio/*"
                            : form.watch("mediaType") === "pdf"
                            ? ".pdf"
                            : "*"
                        }
                        onChange={handleFileChange}
                        className="hidden"
                        id="media-upload"
                      />
                      <label
                        htmlFor="media-upload"
                        className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-muted"
                      >
                        <Upload className="w-4 h-4" />
                        Choose File
                      </label>
                      {selectedFile && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-md">
                          <span className="text-sm truncate max-w-[150px]">
                            {selectedFile.name}
                          </span>
                          <button type="button" onClick={removeFile}>
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </FormItem>
                </div>
              </div>

              {/* Platforms */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Platforms</h3>
                <FormField
                  control={form.control}
                  name="supportivePlatforms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Supportive Platforms *</FormLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.values(SupportivePlatform).map((platform) => (
                          <div key={platform} className="flex items-center space-x-2">
                            <Checkbox
                              id={platform}
                              checked={field.value?.includes(platform)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, platform]);
                                } else {
                                  field.onChange(
                                    field.value.filter((p) => p !== platform)
                                  );
                                }
                              }}
                            />
                            <label htmlFor={platform} className="text-sm">
                              {platform.replace("-", " ").toUpperCase()}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Targeting */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Targeting</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Target Institute IDs with Add Button */}
                  <FormItem>
                    <FormLabel>Target Institute IDs</FormLabel>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Enter Institute ID"
                        value={instituteIdInput}
                        onChange={(e) => setInstituteIdInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addInstituteId();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={addInstituteId}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {targetInstituteIds.map((id) => (
                        <Badge key={id} variant="secondary" className="flex items-center gap-1">
                          {id}
                          <button type="button" onClick={() => removeInstituteId(id)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </FormItem>

                  {/* Target Cities with Add Button */}
                  <FormItem>
                    <FormLabel>Target Cities</FormLabel>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Enter City"
                        value={cityInput}
                        onChange={(e) => setCityInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCity();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={addCity}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {targetCities.map((city) => (
                        <Badge key={city} variant="secondary" className="flex items-center gap-1">
                          {city}
                          <button type="button" onClick={() => removeCity(city)}>
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </FormItem>
                </div>

                <FormField
                  control={form.control}
                  name="targetProvinces"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Provinces</FormLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.values(Province).map((province) => (
                          <div key={province} className="flex items-center space-x-2">
                            <Checkbox
                              id={province}
                              checked={field.value?.includes(province)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...(field.value || []), province]);
                                } else {
                                  field.onChange(
                                    field.value?.filter((p) => p !== province)
                                  );
                                }
                              }}
                            />
                            <label htmlFor={province} className="text-sm">
                              {province.replace(/_/g, " ")}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetDistricts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Districts</FormLabel>
                      <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                        {Object.values(District).map((district) => (
                          <div key={district} className="flex items-center space-x-2">
                            <Checkbox
                              id={district}
                              checked={field.value?.includes(district)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...(field.value || []), district]);
                                } else {
                                  field.onChange(
                                    field.value?.filter((d) => d !== district)
                                  );
                                }
                              }}
                            />
                            <label htmlFor={district} className="text-sm">
                              {district.replace(/_/g, " ")}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Demographics */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Demographics</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minBornYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min Born Year</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="2005"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                            }
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxBornYear"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Born Year</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="2010"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                            }
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="targetGenders"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Genders</FormLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.values(Gender).map((gender) => (
                          <div key={gender} className="flex items-center space-x-2">
                            <Checkbox
                              id={gender}
                              checked={field.value?.includes(gender)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...(field.value || []), gender]);
                                } else {
                                  field.onChange(
                                    field.value?.filter((g) => g !== gender)
                                  );
                                }
                              }}
                            />
                            <label htmlFor={gender} className="text-sm">
                              {gender}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetOccupations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Occupations</FormLabel>
                      <div className="relative mb-2">
                        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search occupations..."
                          value={occupationSearch}
                          onChange={(e) => setOccupationSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                        {filteredOccupations.map((occupation) => (
                          <div key={occupation} className="flex items-center space-x-2">
                            <Checkbox
                              id={occupation}
                              checked={field.value?.includes(occupation)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...(field.value || []), occupation]);
                                } else {
                                  field.onChange(
                                    field.value?.filter((o) => o !== occupation)
                                  );
                                }
                              }}
                            />
                            <label htmlFor={occupation} className="text-sm">
                              {occupation.replace(/_/g, " ")}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* User Types & Subscription Plans */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">User Types & Subscriptions</h3>
                <FormField
                  control={form.control}
                  name="targetUserTypes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target User Types</FormLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.values(UserType).map((userType) => (
                          <div key={userType} className="flex items-center space-x-2">
                            <Checkbox
                              id={userType}
                              checked={field.value?.includes(userType)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...(field.value || []), userType]);
                                } else {
                                  field.onChange(
                                    field.value?.filter((u) => u !== userType)
                                  );
                                }
                              }}
                            />
                            <label htmlFor={userType} className="text-sm">
                              {userType.replace(/_/g, " ")}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="targetSubscriptionPlans"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Subscription Plans</FormLabel>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.values(SubscriptionPlan).map((plan) => (
                          <div key={plan} className="flex items-center space-x-2">
                            <Checkbox
                              id={plan}
                              checked={field.value?.includes(plan)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...(field.value || []), plan]);
                                } else {
                                  field.onChange(
                                    field.value?.filter((p) => p !== plan)
                                  );
                                }
                              }}
                            />
                            <label htmlFor={plan} className="text-sm">
                              {plan.replace(/-/g, " ")}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Display Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Display Settings</h3>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="displayDuration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Duration (seconds) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority (1-10) *</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="maxSendings"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Sendings</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1000"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                            }
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date *</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date *</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex items-center gap-8">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormLabel className="mt-2">Is Active</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cascadeToParents"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormLabel className="mt-2">Cascade to Parents</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Budget & Costs */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Budget & Costs</h3>
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="5000"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                            }
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="costPerClick"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Per Click</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.50"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                            }
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="costPerImpression"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cost Per Impression</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.05"
                            {...field}
                            onChange={(e) =>
                              field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)
                            }
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || isUploading}>
                  {isUploading ? "Uploading..." : isSubmitting ? "Creating..." : "Create Advertisement"}
                </Button>
              </div>
            </form>
          </Form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}