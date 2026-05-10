import React, { useRef, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Camera, Upload, CheckCircle2, XCircle, AlertTriangle,
  ArrowLeft, Loader2, ImageIcon,
} from 'lucide-react';
import { profileImageApi } from '@/api/profileImage.api';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop, convertToPixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

type Stage = 'idle' | 'cropping' | 'uploading' | 'done' | 'error' | 'invalid-token';

// 35mm × 45mm passport
const PROFILE_ASPECT_RATIO = 7 / 9;

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number): Crop {
  return centerCrop(
    makeAspectCrop({ unit: '%', width: 80 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight,
  );
}

const STEP_LABELS: Record<string, string> = {
  validating: 'Validating file…',
  signing:    'Getting upload URL…',
  uploading:  'Uploading image…',
  submitting: 'Saving image…',
  done:       'Upload complete',
};

export default function ReuploadProfileImagePage() {
  const [searchParams] = useSearchParams();
  const uploadToken = searchParams.get('token');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [stage, setStage] = useState<Stage>(uploadToken ? 'idle' : 'invalid-token');
  const [imageSrc, setImageSrc] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<Crop>({ unit: '%', width: 60, height: 60, x: 20, y: 20 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  // ── File selection ────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setErrorMessage('Only JPEG, PNG, and WebP images are allowed.');
      setStage('error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('File size must be under 5 MB.');
      setStage('error');
      return;
    }

    setSelectedFile(file);
    setErrorMessage('');
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setStage('cropping');
    };
    reader.readAsDataURL(file);
  };

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    const crop = centerAspectCrop(width, height, PROFILE_ASPECT_RATIO);
    setCrop(crop);
    setCompletedCrop(convertToPixelCrop(crop, width, height));
  }, []);

  // ── Canvas crop helper ────────────────────────────────────────────
  const getCroppedBlob = (image: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width  = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(
      image,
      crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY,
      0, 0, crop.width, crop.height
    );
    return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.92));
  };

  // ── Upload ────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!completedCrop || !imgRef.current || !selectedFile || !uploadToken) return;

    setStage('uploading');
    setProgress(0);

    try {
      // Build cropped file
      const blob = await getCroppedBlob(imgRef.current, completedCrop);
      const croppedFile = new File([blob], selectedFile.name, { type: 'image/jpeg' });

      // Show a preview of what will be uploaded
      setPreview(URL.createObjectURL(blob));

      const result = await profileImageApi.reuploadProfileImage(
        uploadToken,
        croppedFile,
        (step, pct) => {
          setProgress(pct);
          setProgressLabel(STEP_LABELS[step] || 'Processing…');
        }
      );

      setSuccessMessage(result.message || 'Image submitted for review. You will be notified once approved.');
      setStage('done');
    } catch (err: any) {
      const msg: string = err?.message || 'Upload failed. Please try again.';
      // Distinguish token expiry
      if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('expired')) {
        setErrorMessage('This re-upload link has expired or is invalid. Please contact your administrator for a new link.');
        setStage('invalid-token');
      } else {
        setErrorMessage(msg);
        setStage('error');
      }
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────
  const reset = () => {
    setStage('idle');
    setImageSrc('');
    setSelectedFile(null);
    setCompletedCrop(undefined);
    setProgress(0);
    setProgressLabel('');
    setErrorMessage('');
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 mb-4">
            <Camera className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Upload New Profile Image</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a replacement image below. It will be reviewed by an admin.
          </p>
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardContent className="pt-6 space-y-4">

            {/* ── Invalid / missing token ── */}
            {stage === 'invalid-token' && (
              <div className="text-center py-8 space-y-4">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-500/10 mx-auto">
                  <AlertTriangle className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Invalid or Expired Link</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {errorMessage || 'This re-upload link is missing or has expired. Re-upload links are valid for 7 days after rejection.'}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Please contact support or wait for a new rejection email to receive a fresh link.
                </p>
              </div>
            )}

            {/* ── Idle: select file ── */}
            {stage === 'idle' && (
              <div className="space-y-4">
                <div
                  className="border-2 border-dashed border-border/60 rounded-2xl p-10 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-10 w-10 text-muted-foreground group-hover:text-primary transition-colors mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">Click to select an image</p>
                  <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, or WebP · Max 5 MB</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            )}

            {/* ── Crop ── */}
            {stage === 'cropping' && imageSrc && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  Drag to adjust the crop area, then click <strong>Upload</strong>.
                </p>
                <div className="flex justify-center overflow-hidden rounded-xl">
                  <ReactCrop
                    crop={crop}
                    onChange={(_, pct) => setCrop(pct)}
                    onComplete={c => setCompletedCrop(c)}
                    aspect={PROFILE_ASPECT_RATIO}
                    minWidth={30}
                    minHeight={30}
                    keepSelection
                  >
                    <img
                      ref={imgRef}
                      src={imageSrc}
                      alt="Crop preview"
                      style={{ maxHeight: 320, maxWidth: '100%', display: 'block' }}
                      onLoad={onImageLoad}
                    />
                  </ReactCrop>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={reset}>
                    <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
                  </Button>
                  <Button className="flex-1" onClick={handleUpload} disabled={!completedCrop}>
                    <Upload className="h-4 w-4 mr-1.5" /> Upload
                  </Button>
                </div>
              </div>
            )}

            {/* ── Uploading ── */}
            {stage === 'uploading' && (
              <div className="space-y-4 py-4">
                {preview && (
                  <div className="flex justify-center">
                    <Avatar className="h-20 w-20 ring-2 ring-primary/20">
                      <AvatarImage src={preview} alt="Uploading" className="object-cover" />
                      <AvatarFallback><Loader2 className="h-6 w-6 animate-spin" /></AvatarFallback>
                    </Avatar>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{progressLabel}</span>
                    <span className="text-sm font-medium text-foreground">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                <p className="text-xs text-center text-muted-foreground">Please wait, do not close this page…</p>
              </div>
            )}

            {/* ── Success ── */}
            {stage === 'done' && (
              <div className="text-center py-8 space-y-4">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-500/10 mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                {preview && (
                  <Avatar className="h-20 w-20 ring-4 ring-green-500/30 mx-auto">
                    <AvatarImage src={preview} alt="Uploaded" className="object-cover" />
                    <AvatarFallback>✓</AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <p className="font-semibold text-foreground">Image Submitted</p>
                  <p className="text-sm text-muted-foreground mt-1">{successMessage}</p>
                </div>
                <p className="text-xs text-muted-foreground">You may close this page.</p>
              </div>
            )}

            {/* ── Error ── */}
            {stage === 'error' && (
              <div className="text-center py-8 space-y-4">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-500/10 mx-auto">
                  <XCircle className="h-8 w-8 text-red-500" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Upload Failed</p>
                  <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
                </div>
                <Button onClick={reset} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-1.5" /> Try Again
                </Button>
              </div>
            )}

          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Suraksha LMS · Secure Image Review System
        </p>
      </div>
    </div>
  );
}
