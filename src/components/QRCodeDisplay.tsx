"use client";

import { useEffect, useRef } from "react";
import QRCode from "qrcode";

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  level?: "L" | "M" | "Q" | "H";
  darkColor?: string;
  lightColor?: string;
}

export function QRCodeDisplay({
  value,
  size = 256,
  level = "M",
  darkColor = "#000000",
  lightColor = "#FFFFFF",
}: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      QRCode.toCanvas(
        canvasRef.current,
        value,
        {
          width: size,
          margin: 2,
          errorCorrectionLevel: level,
          color: {
            dark: darkColor,
            light: lightColor,
          },
        },
        (error) => {
          if (error) {
            console.error("Error generating QR code:", error);
          }
        }
      );
    }
  }, [value, size, level, darkColor, lightColor]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded-lg shadow-sm"
      style={{ maxWidth: "100%", height: "auto" }}
    />
  );
}
