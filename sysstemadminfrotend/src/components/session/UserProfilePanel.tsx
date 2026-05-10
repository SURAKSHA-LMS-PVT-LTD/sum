import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Mail, Phone, MapPin, Calendar, Shield, IdCard, Clock } from "lucide-react";
import { format } from "date-fns";

interface UserProfile {
  id: string;
  firstName?: string;
  lastName?: string;
  nameWithInitials?: string;
  email?: string;
  phoneNumber?: string;
  userType?: string;
  dateOfBirth?: string;
  gender?: string;
  birthCertificateNo?: string;
  addressLine1?: string;
  city?: string;
  district?: string;
  province?: string;
  imageUrl?: string;
  subscriptionPlan?: string;
  language?: string;
  createdAt?: string;
  updatedAt?: string;
  studentId?: string;
  emergencyContact?: string;
  bloodGroup?: string;
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className="p-1.5 rounded-md bg-primary/10 shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

export function UserProfilePanel() {
  const { user: authUser } = useAuth();

  const { data, isLoading } = useQuery<{ success: boolean; data: UserProfile }>({
    queryKey: ["current-user-profile"],
    queryFn: () => api.getCurrentUser(),
  });

  const profile = data?.data;

  if (isLoading) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const displayName = profile
    ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || profile.nameWithInitials || "User"
    : authUser?.nameWithInitials || "User";

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={profile?.imageUrl || authUser?.imageUrl || undefined} />
            <AvatarFallback className="text-xl bg-primary/10 text-primary">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-xl">{displayName}</CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">{profile?.userType || authUser?.userType || "USER"}</Badge>
              {profile?.subscriptionPlan && (
                <Badge variant="outline">{profile.subscriptionPlan}</Badge>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          <InfoRow icon={Mail} label="Email" value={profile?.email || authUser?.email} />
          <InfoRow icon={Phone} label="Phone" value={profile?.phoneNumber} />
          <InfoRow icon={IdCard} label="Student ID" value={profile?.studentId} />
          <InfoRow icon={IdCard} label="Birth Certificate" value={profile?.birthCertificateNo} />
          <InfoRow icon={Calendar} label="Date of Birth" value={profile?.dateOfBirth ? format(new Date(profile.dateOfBirth), "MMMM d, yyyy") : undefined} />
          <InfoRow icon={User} label="Gender" value={profile?.gender} />
          <InfoRow icon={Shield} label="Blood Group" value={profile?.bloodGroup} />
          <InfoRow icon={Phone} label="Emergency Contact" value={profile?.emergencyContact} />
          <InfoRow icon={MapPin} label="Address" value={[profile?.addressLine1, profile?.city, profile?.district].filter(Boolean).join(", ") || undefined} />
          <InfoRow icon={MapPin} label="Province" value={profile?.province} />
          <InfoRow icon={Clock} label="Account Created" value={profile?.createdAt ? format(new Date(profile.createdAt), "MMMM d, yyyy") : undefined} />
        </div>
      </CardContent>
    </Card>
  );
}
