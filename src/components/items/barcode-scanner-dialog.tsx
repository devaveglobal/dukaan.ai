"use client";

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
      setTimeout(startScanning, 300);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="p-5 overflow-hidden md:max-w-md">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <ScanLine className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Scan Barcode</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Point camera at a barcode to scan</p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4">
          <div className="relative bg-black rounded-2xl overflow-hidden aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
            {/* Scanning frame overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-52 h-28">
                <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-primary rounded-tl-md" />
                <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-primary rounded-tr-md" />
                <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-primary rounded-bl-md" />
                <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-primary rounded-br-md" />
                {isScanning && (
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-primary/70 animate-[scan_2s_ease-in-out_infinite]" />
                )}
              </div>
            </div>
            {!isScanning && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                <Button onClick={startScanning} variant="secondary" className="gap-2">
                  <ScanLine className="w-4 h-4" /> Start Camera
                </Button>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Barcode will be detected automatically when in frame
          </p>

          <Button variant="outline" className="w-full gap-2" onClick={() => { stopScanning(); onClose(); }}>
            <X className="w-4 h-4" /> Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
