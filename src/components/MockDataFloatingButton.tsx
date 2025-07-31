"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Sparkles,
} from "lucide-react";

interface MockDataStatus {
  totalRecords: number;
  totalDevices: number;
  timeRange: {
    start: number | null;
    end: number | null;
  };
  devices: Array<{ deviceId: string; count: number }>;
  databaseSize: string;
}

export default function MockDataFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<MockDataStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);

  // 생성 옵션
  const [days, setDays] = useState("1");
  const [interval, setInterval] = useState("1000");
  const [devices, setDevices] = useState("3");

  const { toast } = useToast();

  // 상태 조회
  const fetchStatus = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/mock/status");
      if (!response.ok) throw new Error("Failed to fetch status");

      const result = await response.json();
      setStatus(result.data);
    } catch (error) {
      console.error("Error fetching status:", error);
      toast({
        title: "오류",
        description: "상태 조회에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // Mock 데이터 생성
  const handleGenerate = async () => {
    setGenerating(true);

    try {
      const response = await fetch("http://localhost:8000/api/mock/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          days: parseFloat(days),
          interval: parseInt(interval),
          devices: parseInt(devices),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate data");
      }

      const result = await response.json();

      toast({
        title: "성공",
        description: `${result.details.totalRecords.toLocaleString()}개의 데이터가 생성되었습니다.`,
      });

      // 상태 새로고침
      await fetchStatus();

      // 페이지 새로고침 (타임라인 업데이트를 위해)
      window.location.reload();
    } catch (error) {
      console.error("Error generating data:", error);
      toast({
        title: "오류",
        description:
          error instanceof Error
            ? error.message
            : "데이터 생성에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  // 데이터베이스 초기화
  const handleClear = async () => {
    if (
      !confirm(
        "정말로 모든 센서 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다."
      )
    ) {
      return;
    }

    setClearing(true);

    try {
      const response = await fetch("http://localhost:8000/api/mock/clear", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear data");
      }

      toast({
        title: "성공",
        description: "모든 센서 데이터가 삭제되었습니다.",
      });

      // 상태 새로고침
      await fetchStatus();

      // 페이지 새로고침
      window.location.reload();
    } catch (error) {
      console.error("Error clearing data:", error);
      toast({
        title: "오류",
        description: "데이터 삭제에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  // Sheet 열릴 때 상태 조회
  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetchStatus().finally(() => setLoading(false));
    }
  }, [isOpen]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          className="fixed bottom-6 right-6 rounded-full shadow-lg"
          size="icon"
          variant="default"
        >
          <Database className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Mock 데이터 관리
          </SheetTitle>
          <SheetDescription>
            테스트용 센서 데이터를 생성하거나 삭제할 수 있습니다.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* 현재 상태 */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">현재 데이터베이스 상태</h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : status ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">총 레코드</p>
                    <p className="text-2xl font-bold">
                      {status.totalRecords.toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">데이터 크기</p>
                    <p className="text-2xl font-bold">{status.databaseSize}</p>
                  </div>
                </div>

                {status.devices.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      디바이스별 데이터
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {status.devices.map((device) => (
                        <Badge key={device.deviceId} variant="secondary">
                          {device.deviceId}: {device.count.toLocaleString()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {status.timeRange.start && status.timeRange.end && (
                  <div className="text-sm text-muted-foreground">
                    <p>
                      데이터 기간:{" "}
                      {new Date(status.timeRange.start).toLocaleDateString()} ~{" "}
                      {new Date(status.timeRange.end).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                데이터가 없습니다
              </div>
            )}
          </div>

          {/* Mock 데이터 생성 */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-medium">Mock 데이터 생성</h3>

            <div className="grid gap-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="days">기간 (일)</Label>
                  <Input
                    id="days"
                    type="number"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    min="0.1"
                    max="30"
                    step="0.1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interval">간격 (ms)</Label>
                  <Input
                    id="interval"
                    type="number"
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    min="100"
                    max="60000"
                    step="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="devices">디바이스</Label>
                  <Input
                    id="devices"
                    type="number"
                    value={devices}
                    onChange={(e) => setDevices(e.target.value)}
                    min="1"
                    max="5"
                  />
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                약{" "}
                {Math.floor(
                  ((parseFloat(days) * 24 * 3600 * 1000) / parseInt(interval)) *
                    parseInt(devices) *
                    0.7
                ).toLocaleString()}
                개의 데이터가 생성됩니다.
              </div>

              <Button
                onClick={handleGenerate}
                disabled={generating}
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mock 데이터 생성
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 데이터 초기화 */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-sm font-medium text-red-600">위험 구역</h3>

            <Button
              variant="destructive"
              onClick={handleClear}
              disabled={clearing || status?.totalRecords === 0}
              className="w-full"
            >
              {clearing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  삭제 중...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  모든 데이터 삭제
                </>
              )}
            </Button>
          </div>
        </div>

        <SheetFooter className="mt-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            <span>Mock 데이터는 테스트 목적으로만 사용하세요.</span>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
