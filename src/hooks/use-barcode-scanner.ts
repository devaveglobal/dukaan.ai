"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";

interface UseBarcodeScanner {
  isScanning: boolean;
  startScanning: () => void;
  stopScanning: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useBarcodeScanner(onDetected: (barcode: string) => void): UseBarcodeScanner {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const stopScanning = useCallback(() => {
    readerRef.current?.reset();
    setIsScanning(false);
  }, []);

  const startScanning = useCallback(() => {
    if (!videoRef.current) return;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;
    setIsScanning(true);

    reader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
      if (result) {
        onDetected(result.getText());
        stopScanning();
      }
      if (err && !(err instanceof NotFoundException)) {
        console.error(err);
      }
    });
  }, [onDetected, stopScanning]);

  useEffect(() => () => { readerRef.current?.reset(); }, []);

  return { isScanning, startScanning, stopScanning, videoRef };
}
