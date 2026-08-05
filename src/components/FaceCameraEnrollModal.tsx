import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Camera, CheckCircle2, ShieldCheck, RefreshCw, AlertCircle, Scan, Sparkles } from 'lucide-react';

interface FaceCameraEnrollModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (capturedImageDataUrl: string) => Promise<void> | void;
  userName?: string;
}

export function FaceCameraEnrollModal({
  isOpen,
  onClose,
  onCapture,
  userName = 'Employee',
}: FaceCameraEnrollModalProps) {
  const [hasCamera, setHasCamera] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setHasCamera(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setHasCamera(true);
      } else {
        setCameraError('Webcam is not supported in this browser.');
      }
    } catch (err: any) {
      console.warn('Webcam permission or device error:', err);
      setHasCamera(false);
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
        setCameraError('Camera access blocked. Please click the lock 🔒 icon in your browser URL bar and set Camera to Allow.');
      } else {
        setCameraError('No webcam detected on this device. Please connect a camera and try again.');
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setPreviewImage(null);
      setCameraError(null);
      return;
    }

    setPreviewImage(null);
    startCamera();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const snapPhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Flip horizontally to mirror webcam view
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setPreviewImage(dataUrl);
    } catch (e) {
      console.error('Snap photo error:', e);
    }
  };

  const handleConfirmSave = async () => {
    if (!previewImage) return;
    setIsCapturing(true);
    try {
      await onCapture(previewImage);
      stopCamera();
      onClose();
    } catch (err) {
      console.error('Save face image error:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const handleRetake = () => {
    setPreviewImage(null);
    if (!streamRef.current) {
      startCamera();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { stopCamera(); onClose(); } }}>
      <DialogContent className="max-w-md w-full p-6 rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-2xl space-y-4">
        <DialogHeader className="p-0 space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <DialogTitle className="text-lg font-bold text-white">Biometric Face ID Camera</DialogTitle>
          </div>
          <DialogDescription className="text-slate-400 text-xs">
            Position your face in the camera frame to capture biometric profile photo — <span className="text-emerald-400 font-semibold">{userName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full h-64 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden">
          {previewImage ? (
            <img src={previewImage} alt="Captured Face" className="w-full h-full object-cover" />
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover scale-x-[-1] ${hasCamera ? 'block' : 'hidden'}`}
            />
          )}

          {!hasCamera && !previewImage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-gradient-to-b from-slate-900 to-slate-950 z-10">
              <Camera className="h-10 w-10 text-cyan-400 animate-pulse mb-2" />
              <p className="text-xs font-semibold text-slate-200">Opening Camera...</p>
              {cameraError && (
                <div className="mt-2 p-2.5 bg-amber-950/70 border border-amber-500/40 rounded-lg max-w-xs">
                  <p className="text-[11px] text-amber-300 flex items-start gap-1 text-left leading-tight">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                    <span>{cameraError}</span>
                  </p>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={startCamera}
                className="mt-3 text-xs h-8 border-slate-700 text-cyan-300 hover:bg-slate-800 gap-1.5"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Camera Access
              </Button>
            </div>
          )}

          {!previewImage && hasCamera && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
              <div className="relative w-40 h-48 rounded-[40px] border-2 border-cyan-400/80 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-cyan-400" />
                <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-cyan-400" />
                <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-cyan-400" />
                <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-cyan-400" />
              </div>
            </div>
          )}
        </div>

        <div className="pt-2 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => { stopCamera(); onClose(); }}
            className="text-xs h-9 border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>

          {previewImage ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleRetake}
                className="text-xs h-9 border-slate-700 text-amber-300 hover:bg-slate-800 gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Retake
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSave}
                disabled={isCapturing}
                className="text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 px-4"
              >
                <CheckCircle2 className="h-4 w-4" /> Save Face Photo
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              onClick={snapPhoto}
              disabled={!hasCamera}
              className="text-xs h-9 bg-cyan-600 hover:bg-cyan-500 text-white font-bold gap-1.5 px-4 shadow-lg shadow-cyan-600/30"
            >
              <Camera className="h-4 w-4" /> Capture Photo
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
