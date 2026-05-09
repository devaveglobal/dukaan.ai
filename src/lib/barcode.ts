"use client";

import {
  BrowserMultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
  RGBLuminanceSource,
  BinaryBitmap,
  HybridBinarizer,
  MultiFormatReader,
} from "@zxing/library";

const ALL_FORMATS = [
  BarcodeFormat.QR_CODE,
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.CODE_93,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.ITF,
  BarcodeFormat.DATA_MATRIX,
  BarcodeFormat.PDF_417,
  BarcodeFormat.AZTEC,
  BarcodeFormat.CODABAR,
];

function buildReader() {
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, ALL_FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  return reader;
}

/**
 * Attempts to decode a barcode from an image File.
 * Strategy:
 *  1. Draw image onto a canvas at original size
 *  2. Try decode on full image
 *  3. If fails, try grayscale + contrast boost
 *  4. If fails, try scaled-up version (helps with small barcodes)
 */
export async function decodeBarcodeFromImage(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const result =
          tryDecode(img, img.naturalWidth, img.naturalHeight) ??
          tryDecode(img, img.naturalWidth, img.naturalHeight, true) ??
          tryDecode(img, img.naturalWidth * 2, img.naturalHeight * 2) ??
          tryDecode(img, img.naturalWidth * 2, img.naturalHeight * 2, true);
        resolve(result);
      } catch {
        resolve(null);
      }
    };

    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

function tryDecode(
  img: HTMLImageElement,
  width: number,
  height: number,
  enhanceContrast = false
): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    if (enhanceContrast) {
      // Boost contrast to help with faint or low-quality barcodes
      ctx.filter = "contrast(1.8) grayscale(1)";
    }

    ctx.drawImage(img, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;

    // Convert RGBA to luminance array (ZXing expects Uint8ClampedArray of luminance)
    const luminances = new Uint8ClampedArray(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      // Standard luminance formula
      luminances[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    const source = new RGBLuminanceSource(luminances, width, height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const reader = buildReader();
    const result = reader.decode(bitmap);
    return result.getText();
  } catch {
    return null;
  }
}
