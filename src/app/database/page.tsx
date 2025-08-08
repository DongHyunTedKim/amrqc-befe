"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Database,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Trash2,
  BarChart3,
  HardDrive,
  Activity,
  Clock,
  Users,
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
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Mock 데이터 생성 옵션
  const [days, setDays] = useState("1");
  const [interval, setInterval] = useState("1000");
  const [deviceCount, setDeviceCount] = useState("3");

  const { toast } = useToast();

  // 페이지 로드 시 데이터 조회
  useEffect(() => {
    fetchDatabaseStatus();
    fetchDevices();
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

  // 디바이스 목록 조회
  const fetchDevices = async () => {
    setLoadingDevices(true);
    try {
      const response = await fetch("http://localhost:8000/api/data/devices");
      if (!response.ok) throw new Error("Failed to fetch devices");

      const result = await response.json();
      setDevices(result.data);
    } catch (error) {
      console.error("Error fetching devices:", error);
      toast({
        title: "오류",
        description: "디바이스 목록 조회에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setLoadingDevices(false);
    }
  };

  // 벌크 Mock 데이터 생성
  const handleGenerateBulkData = async () => {
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
          devices: parseInt(deviceCount),
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
      await Promise.all([fetchDatabaseStatus(), fetchDevices()]);
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
  const handleClearDatabase = async () => {
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

      const result = await response.json();

      toast({
        title: "데이터베이스 완전 정리 완료",
        description: `${
          result.data?.deletedRecords?.toLocaleString() || "0"
        }개 레코드 삭제 및 파일 압축 완료`,
      });

      // 상태 새로고침
      await Promise.all([fetchDatabaseStatus(), fetchDevices()]);
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

  // 데이터베이스 새로고침
  const handleRefresh = async () => {
    await Promise.all([fetchDatabaseStatus(), fetchDevices()]);
    toast({
      title: "새로고침 완료",
      description: "데이터베이스 상태가 업데이트되었습니다.",
    });
  };

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Database className="h-8 w-8" />
            데이터베이스 관리
          </h1>
          <p className="text-muted-foreground mt-2">
            센서 데이터베이스 상태 조회 및 관리
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
            <CardTitle className="text-sm font-medium">활성 디바이스</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingDevices ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                devices.filter((d) => d.active).length
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              전체 {devices.length}개
            </p>
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

      {/* 디바이스 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>디바이스 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingDevices ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : devices.length > 0 ? (
            <div className="space-y-3">
              {devices.map((device) => (
                <div
                  key={device.deviceId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium">{device.deviceId}</div>
                      <div className="text-sm text-muted-foreground">
                        첫 데이터: {new Date(device.firstSeen).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        마지막: {new Date(device.lastSeen).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={device.active ? "default" : "secondary"}>
                      {device.active ? "활성" : "비활성"}
                    </Badge>
                    <div className="text-right">
                      <div className="font-medium">
                        {device.dataCount.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        레코드
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              등록된 디바이스가 없습니다
            </div>
          )}
        </CardContent>
      </Card>

      {/* 벌크 데이터 생성 */}
      <Card>
        <CardHeader>
          <CardTitle>벌크 데이터 생성</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
                <Label htmlFor="devices">디바이스 수</Label>
                <Input
                  id="devices"
                  type="number"
                  value={deviceCount}
                  onChange={(e) => setDeviceCount(e.target.value)}
                  min="1"
                  max="5"
                />
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              약{" "}
              {Math.floor(
                ((parseFloat(days) * 24 * 3600 * 1000) / parseInt(interval)) *
                  parseInt(deviceCount) *
                  0.7
              ).toLocaleString()}
              개의 데이터가 생성됩니다.
            </div>

            <Button
              onClick={handleGenerateBulkData}
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
                  벌크 데이터 생성
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 위험 구역 */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-red-600">위험 구역</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span>아래 작업들은 되돌릴 수 없습니다. 신중히 진행하세요.</span>
          </div>

          <Button
            variant="destructive"
            onClick={handleClearDatabase}
            disabled={clearing || databaseStatus?.totalRecords === 0}
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
        </CardContent>
      </Card>
    </div>
  );
}
