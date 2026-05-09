"use client";

import { useRef } from "react";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScanLine, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

export default function BarcodeScannerDialog({ open, onClose, onDetected }: Props) {
  const handleDetected = (barcode: string) => {
    onDetected(barcode);
    onClose();
  };

  const { isScanning, startScanning, stopScanning, videoRef } = useBarcodeScanner(handleDetected);

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen) {
      stopScanning();
      onClose();
    } else {
      // Small delay to let the video element mount
      setTimeout(startScanning, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5" /> Scan Barcode
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-24 border-2 border-primary rounded-md opacity-70" />
            </div>
            {!isScanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <Button onClick={startScanning} variant="secondary">
                  Start Camera
                </Button>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Point your camera at a barcode to scan it automatically.
          </p>
          <Button variant="outline" className="w-full" onClick={() => { stopScanning(); onClose(); }}>
            <X className="w-4 h-4 mr-2" /> Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
