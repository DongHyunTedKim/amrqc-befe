"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { Download, Printer, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";

export function AMRQRCodeGenerator() {
  const [deviceId, setDeviceId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [qrValue, setQrValue] = useState("");
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 디바이스 ID가 변경될 때마다 QR 코드 값 업데이트
  useEffect(() => {
    if (deviceId.trim()) {
      setQrValue(deviceId.trim());
    } else {
      setQrValue("");
    }
  }, [deviceId]);

  // QR 코드 다운로드 기능
  const handleDownload = async () => {
    if (!qrValue) {
      toast({
        title: "오류",
        description: "디바이스 ID를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      // QR 코드를 고해상도로 생성
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, qrValue, {
        width: 512,
        margin: 4,
        errorCorrectionLevel: "H",
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      // 캔버스를 이미지로 변환하여 다운로드
      const link = document.createElement("a");
      link.download = `AMR-${qrValue}-QR.png`;
      link.href = qrCanvas.toDataURL();
      link.click();

      toast({
        title: "다운로드 완료",
        description: `${qrValue} QR 코드가 다운로드되었습니다.`,
      });
    } catch (error) {
      console.error("QR 코드 다운로드 오류:", error);
      toast({
        title: "다운로드 실패",
        description: "QR 코드 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 출력 기능
  const handlePrint = async () => {
    if (!qrValue) {
      toast({
        title: "오류",
        description: "디바이스 ID를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    try {
      // QR 코드를 미리 생성
      const qrCanvas = document.createElement("canvas");
      await QRCode.toCanvas(qrCanvas, qrValue, {
        width: 256,
        margin: 2,
        errorCorrectionLevel: "H",
        color: {
          dark: "#000000",
          light: "#FFFFFF",
        },
      });

      // 캔버스를 Base64 이미지로 변환
      const qrImageData = qrCanvas.toDataURL("image/png");

      // 출력을 위한 새 창 생성
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast({
          title: "출력 실패",
          description: "팝업이 차단되었습니다. 팝업을 허용해주세요.",
          variant: "destructive",
        });
        return;
      }

      // QR 코드 이미지를 포함한 HTML 생성
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>AMR QR 코드 - ${qrValue}</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: white;
              }
              .qr-container {
                text-align: center;
                padding: 40px;
                border: 2px solid #000;
                border-radius: 10px;
                max-width: 400px;
              }
              .device-id {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 20px;
                color: #000;
              }
              .qr-code {
                margin: 20px 0;
              }
              .qr-code img {
                max-width: 100%;
                height: auto;
              }
              .instructions {
                font-size: 14px;
                color: #666;
                margin-top: 20px;
                line-height: 1.4;
              }
              @media print {
                body { 
                  margin: 0; 
                  print-color-adjust: exact;
                  -webkit-print-color-adjust: exact;
                }
                .qr-container { 
                  border: 2px solid #000; 
                  box-shadow: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="qr-container">
              <div class="device-id">AMR 디바이스: ${qrValue}</div>
              <div class="qr-code">
                <img src="${qrImageData}" alt="QR Code for ${qrValue}" />
              </div>
              <div class="instructions">
                스마트폰 앱에서 이 QR 코드를 스캔하여<br>
                디바이스를 식별하세요.
              </div>
            </div>
            <script>
              // 페이지 로드 완료 후 자동 출력
              window.onload = function() {
                setTimeout(() => {
                  window.print();
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();

      toast({
        title: "출력 준비 완료",
        description: `${qrValue} QR 코드 출력 페이지가 열렸습니다.`,
      });
    } catch (error) {
      console.error("QR 코드 출력 오류:", error);
      toast({
        title: "출력 실패",
        description: "QR 코드 출력 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <QrCode className="h-4 w-4" />
          AMR QR 생성
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AMR 디바이스 QR 코드 생성</DialogTitle>
          <DialogDescription>
            AMR 장비에 부착할 QR 코드를 생성하고 다운로드하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="device-id">디바이스 ID</Label>
            <Input
              id="device-id"
              placeholder="예: AMR-001"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="w-full"
            />
          </div>

          {qrValue && (
            <div className="flex flex-col items-center space-y-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="text-sm font-medium text-center">
                디바이스 ID: <span className="font-bold">{qrValue}</span>
              </div>
              <QRCodeDisplay
                value={qrValue}
                size={200}
                level="H"
                darkColor="#000000"
                lightColor="#FFFFFF"
              />
              <div className="text-xs text-muted-foreground text-center">
                스마트폰 앱에서 이 QR 코드를 스캔하여 디바이스를 식별합니다.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={!qrValue}
            className="gap-2"
          >
            <Printer className="h-4 w-4" />
            출력
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!qrValue}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            다운로드
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
