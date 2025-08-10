"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  Loader2,
  AlertTriangle,
  Trash2,
  BarChart3,
  HardDrive,
  Activity,
  Clock,
  Download,
  RotateCcw,
  Settings,
} from "lucide-react";

interface DatabaseStatus {
  totalRecords: number;
  totalDevices: number;
  timeRange: {
    start: number | null;
    end: number | null;
  };
  devices: Array<{ deviceId: string; count: number }>;
  databaseSize: string;
}

interface DatabaseSettings {
  retentionDays: number | null; // null = 무기한
  autoCleanup: boolean;
  compressionEnabled: boolean;
}

interface DeviceInfo {
  deviceId: string;
  dataCount: number;
  firstSeen: number;
  lastSeen: number;
  active: boolean;
}

export default function DatabasePage() {
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus | null>(
    null
  );
  const [databaseSettings, setDatabaseSettings] = useState<DatabaseSettings>(
    () => {
      // 로컬 저장소에서 복원 (즉시 적용 요구사항 반영)
      try {
        const raw = localStorage.getItem("db.settings");
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            retentionDays: parsed.retentionDays ?? null,
            autoCleanup: parsed.autoCleanup ?? true,
            compressionEnabled: parsed.compressionEnabled ?? false,
          } as DatabaseSettings;
        }
      } catch {}
      return {
        retentionDays: null, // 기본값: 무기한
        autoCleanup: true,
        compressionEnabled: false,
      } as DatabaseSettings;
    }
  );
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const { toast } = useToast();

  // 페이지 로드 시 데이터 조회
  useEffect(() => {
    fetchDatabaseStatus();
  }, []);

  // 데이터베이스 상태 조회
  const fetchDatabaseStatus = async () => {
    setLoadingStatus(true);
    try {
      const response = await fetch("http://localhost:8000/api/mock/status");
      if (!response.ok) throw new Error("Failed to fetch status");

      const result = await response.json();
      setDatabaseStatus(result.data);
    } catch (error) {
      console.error("Error fetching status:", error);
      toast({
        title: "오류",
        description: "데이터베이스 상태 조회에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoadingStatus(false);
    }
  };

  // 데이터베이스 초기화
  const handleClearDatabase = async () => {
    setClearing(true);

    try {
      const response = await fetch("http://localhost:8000/api/mock/clear", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear data");
      }

      const result = await response.json();

      toast({
        title: "데이터베이스 완전 정리 완료",
        description: `${
          result.data?.deletedRecords?.toLocaleString() || "0"
        }개 레코드 삭제 및 파일 압축 완료`,
      });

      // 상태 새로고침
      await fetchDatabaseStatus();
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

  const isTypedConfirmationValid =
    confirmText.trim().toUpperCase() === "DELETE ALL";

  const onRequestDeleteAll = () => {
    setConfirmText("");
    setConfirmOpen(true);
  };

  const onConfirmDeleteAll = async () => {
    if (!isTypedConfirmationValid) return;
    setConfirmOpen(false);
    await handleClearDatabase();
  };

  // 데이터베이스 새로고침
  const handleRefresh = async () => {
    await fetchDatabaseStatus();
    toast({
      title: "새로고침 완료",
      description: "데이터베이스 상태가 업데이트되었습니다.",
    });
  };

  // 데이터 내보내기
  const handleExportData = async () => {
    setExporting(true);
    try {
      // 파라미터 없이 전체 기간, 전체 디바이스 다운로드 지원 (서버 수정 반영)
      const response = await fetch("http://localhost:8000/api/data/download", {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Failed to export data");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sensor-data-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "내보내기 완료",
        description: "데이터가 성공적으로 내보내졌습니다.",
      });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "오류",
        description: "데이터 내보내기에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  // 즉시 적용 저장: 사용자가 값을 변경하면 바로 로컬 저장소에 반영
  useEffect(() => {
    try {
      localStorage.setItem("db.settings", JSON.stringify(databaseSettings));
    } catch {}
  }, [databaseSettings]);

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-8 w-8" />
            데이터베이스
          </h1>
          <p className="text-muted-foreground mt-2">
            디바이스 & 센서 데이터베이스 관리
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline">
          <Activity className="mr-2 h-4 w-4" />
          새로고침
        </Button>
      </div>

      {/* 데이터베이스 개요 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 레코드</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStatus ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                databaseStatus?.totalRecords.toLocaleString() || "0"
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">데이터 크기</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStatus ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                databaseStatus?.databaseSize || "0 KB"
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">데이터 기간</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {loadingStatus ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : databaseStatus?.timeRange.start &&
                databaseStatus?.timeRange.end ? (
                <>
                  <div>
                    {new Date(
                      databaseStatus.timeRange.start
                    ).toLocaleDateString()}
                  </div>
                  <div className="text-muted-foreground">~</div>
                  <div>
                    {new Date(
                      databaseStatus.timeRange.end
                    ).toLocaleDateString()}
                  </div>
                </>
              ) : (
                "데이터 없음"
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 데이터베이스 설정 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <CardTitle>데이터베이스 설정</CardTitle>
          </div>
          <CardDescription>
            저장된 센서 데이터 관리 및 정리 설정입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 데이터 보관 기간 - '데이터 내보내기'와 동일한 좌/우 구성 */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">데이터 보관 기간</h4>
              <p className="text-sm text-muted-foreground">
                1~30일 또는 무기한으로 보관 기간을 설정합니다. 기본값: 무기한
              </p>
            </div>
            <div>
              <select
                id="retention-days"
                className="h-9 rounded-md border px-3 text-sm bg-background"
                value={
                  databaseSettings.retentionDays === null
                    ? "unlimited"
                    : String(databaseSettings.retentionDays)
                }
                onChange={(e) => {
                  const v = e.target.value;
                  setDatabaseSettings((prev) => ({
                    ...prev,
                    retentionDays:
                      v === "unlimited"
                        ? null
                        : Math.max(1, Math.min(30, parseInt(v) || 1)),
                  }));
                }}
              >
                {Array.from({ length: 30 }).map((_, i) => {
                  const day = i + 1;
                  return (
                    <option key={day} value={day}>
                      {day}일
                    </option>
                  );
                })}
                <option value="unlimited">무기한</option>
              </select>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">데이터 내보내기</h4>
                <p className="text-sm text-muted-foreground">
                  전체 데이터를 CSV 형식으로 내보냅니다.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={handleExportData}
                disabled={exporting || databaseStatus?.totalRecords === 0}
                className="gap-2"
              >
                {exporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    내보내기 중...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    내보내기
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* 저장 버튼 제거: 즉시 적용 */}
        </CardContent>
      </Card>

      {/* 위험 구역 */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">위험 구역</CardTitle>
          <CardDescription className="text-red-600">
            아래 작업들은 되돌릴 수 없습니다. 신중히 진행하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">데이터 초기화</h4>
              <p className="text-sm text-red-500">
                모든 센서 데이터가 영구적으로 삭제됩니다.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={onRequestDeleteAll}
              disabled={clearing || databaseStatus?.totalRecords === 0}
              className="gap-2"
            >
              {clearing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  삭제 중...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4" />
                  모든 데이터 삭제
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>모든 데이터를 삭제하시겠습니까?</DialogTitle>
            <DialogDescription>
              이 작업은 되돌릴 수 없습니다. 계속하려면 아래에 대문자로 다음
              문구를 입력하세요: DELETE ALL
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirmText">확인 문구</Label>
            <Input
              id="confirmText"
              placeholder="DELETE ALL"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={!isTypedConfirmationValid || clearing}
              onClick={onConfirmDeleteAll}
            >
              영구 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
