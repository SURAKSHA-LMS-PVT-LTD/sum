import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { instituteSettingsApi, InstituteProfileResponse } from '@/api/instituteSettings.api';
import { SafeImage } from '@/components/ui/SafeImage';
import { Building2, Mail, Phone, MapPin, Globe, Facebook, Youtube, Eye, Target, Image as ImageIcon, Palette } from 'lucide-react';

const InstituteProfileCard = () => {
  const { selectedInstitute, currentInstituteId } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<InstituteProfileResponse | null>(null);

  const instituteId = currentInstituteId || selectedInstitute?.id;

  useEffect(() => {
    if (!instituteId) return;
    setLoading(true);
    instituteSettingsApi.getProfile(instituteId)
      .then(setProfile)
      .catch((err: any) => {
        toast({ title: 'Error', description: err?.message || 'Failed to load profile', variant: 'destructive' });
      })
      .finally(() => setLoading(false));
  }, [instituteId, toast]);

  if (!instituteId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No institute selected</p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!profile) return null;

  const primaryColor = profile.primaryColorCode || undefined;
  const secondaryColor = profile.secondaryColorCode || undefined;

  return (
    <Card className="overflow-hidden">
      {/* Header with branding gradient */}
      <div
        className="h-3 w-full"
        style={{ background: primaryColor ? `linear-gradient(90deg, ${primaryColor}, ${secondaryColor || primaryColor})` : undefined }}
      />
      <CardHeader className="flex flex-row items-start gap-4 pb-3">
        <div className="shrink-0">
          {profile.logoUrl ? (
            <SafeImage
              src={profile.logoUrl}
              alt={profile.name}
              className="h-16 w-16 rounded-xl object-contain border border-border bg-background p-1"
              fallback={
                <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-muted-foreground" />
                </div>
              }
            />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center">
              <Building2 className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold leading-tight">{profile.name}</h3>
          {profile.shortName && (
            <span className="text-sm text-muted-foreground">{profile.shortName}</span>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {profile.type && <Badge variant="secondary" className="text-xs">{profile.type}</Badge>}
            {profile.city && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <MapPin className="h-3 w-3" /> {profile.city}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {/* Contact */}
        <div className="space-y-2">
          {profile.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`mailto:${profile.email}`} className="text-primary hover:underline truncate">{profile.email}</a>
            </div>
          )}
          {profile.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <a href={`tel:${profile.phone}`} className="hover:underline">{profile.phone}</a>
            </div>
          )}
        </div>

        {/* Brand Colors */}
        {(primaryColor || secondaryColor) && (
          <div className="space-y-1 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Palette className="h-3 w-3" /> Brand Colors
            </p>
            <div className="flex items-center gap-2">
              {primaryColor && (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: primaryColor }} />
                  <span className="text-xs text-muted-foreground">{primaryColor}</span>
                </div>
              )}
              {secondaryColor && (
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded border border-border" style={{ backgroundColor: secondaryColor }} />
                  <span className="text-xs text-muted-foreground">{secondaryColor}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading GIF */}
        {profile.loadingGifUrl && (
          <div className="space-y-1 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ImageIcon className="h-3 w-3" /> Loading Animation
            </p>
            <img src={profile.loadingGifUrl} alt="Loading GIF" className="h-12 w-auto rounded" />
          </div>
        )}

        {/* Cover / Legacy Image */}
        {profile.imageUrl && (
          <div className="space-y-1 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ImageIcon className="h-3 w-3" /> Cover Image
            </p>
            <img src={profile.imageUrl} alt="Cover" className="w-full h-32 object-cover rounded-lg" />
          </div>
        )}

        {/* Gallery */}
        {profile.imageUrls && profile.imageUrls.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ImageIcon className="h-3 w-3" /> Gallery ({profile.imageUrls.length})
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {profile.imageUrls.map((url, idx) => (
                <img key={idx} src={url} alt={`Gallery ${idx + 1}`} className="w-full h-20 object-cover rounded" />
              ))}
            </div>
          </div>
        )}

        {/* Vision & Mission */}
        {(profile.vision || profile.mission) && (
          <div className="space-y-3 pt-2 border-t border-border">
            {profile.vision && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Eye className="h-3 w-3" /> Vision
                </p>
                <p className="text-sm leading-relaxed">{profile.vision}</p>
              </div>
            )}
            {profile.mission && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" /> Mission
                </p>
                <p className="text-sm leading-relaxed">{profile.mission}</p>
              </div>
            )}
          </div>
        )}

        {/* Social Links */}
        {(profile.websiteUrl || profile.facebookPageUrl || profile.youtubeChannelUrl) && (
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            {profile.websiteUrl && (
              <a href={profile.websiteUrl} target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Globe className="h-4 w-4" />
              </a>
            )}
            {profile.facebookPageUrl && (
              <a href={profile.facebookPageUrl} target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Facebook className="h-4 w-4" />
              </a>
            )}
            {profile.youtubeChannelUrl && (
              <a href={profile.youtubeChannelUrl} target="_blank" rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Youtube className="h-4 w-4" />
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InstituteProfileCard;
