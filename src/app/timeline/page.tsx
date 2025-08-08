"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BarChart3,
  List,
  Download,
  Calendar,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff,
  RotateCcw,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { TimelineChart } from "@/features/timeline/components/TimelineChart";
import { useTimelineWebSocket } from "@/features/timeline/hooks/useTimelineWebSocket";

// 센서 데이터 타입 정의
interface SensorData {
  id: number;
  deviceId: string;
  timestamp: number;
  sensorType: string;
  value: any;
  createdAt: string;
}

interface SummaryData {
  total: {
    totalRecords: number;
    totalDevices: number;
    totalSensorTypes: number;
    minTime: number;
    maxTime: number;
  };
  byDevice: Record<
    string,
    {
      totalRecords: number;
      sensors: Record<
        string,
        {
          count: number;
          days: number;
          timeRange: { start: number; end: number };
        }
      >;
      timeRange: { start: number; end: number };
    }
  >;
}

export default function TimelinePage() {
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [selectedAMR, setSelectedAMR] = useState<string>("all");
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [selectedSensorTypes, setSelectedSensorTypes] = useState<string[]>([
    "accelerometer",
    "gyroscope",
  ]);
  const [selectedRange, setSelectedRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [realtimeEnabled, setRealtimeEnabled] = useState(false);

  // API 기본 URL
  const API_BASE = "http://localhost:8000/api";

  // 센서 데이터 조회
  const fetchSensorData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 최근 24시간 데이터 조회
      const endTime = Date.now();
      const startTime = endTime - 24 * 60 * 60 * 1000; // 24시간 전

      const params = new URLSearchParams({
        startTs: startTime.toString(),
        endTs: endTime.toString(),
        limit: viewMode === "graph" ? "1000" : "50", // 그래프 모드에서는 더 많은 데이터
      });

      // AMR 필터 적용
      if (selectedAMR !== "all") {
        params.append("deviceId", selectedAMR);
      }

      const response = await fetch(`${API_BASE}/data?${params}`);
      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const result = await response.json();
      setSensorData(result.data || []);
    } catch (error) {
      console.error("센서 데이터 조회 실패:", error);
      setError(
        error instanceof Error ? error.message : "데이터 조회에 실패했습니다"
      );
    } finally {
      setLoading(false);
    }
  }, [selectedAMR, viewMode]);

  // 요약 통계 조회
  const fetchSummaryData = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/data/summary`);
      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const result = await response.json();
      setSummaryData(result.data);
    } catch (error) {
      console.error("요약 데이터 조회 실패:", error);
    }
  }, []);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchSensorData();
    fetchSummaryData();
  }, [fetchSensorData, fetchSummaryData]);

  // 새로고침 핸들러
  const handleRefresh = () => {
    fetchSensorData();
    fetchSummaryData();
  };

  // 센서 타입 토글 핸들러
  const handleSensorTypeToggle = (sensorType: string) => {
    setSelectedSensorTypes((prev) =>
      prev.includes(sensorType)
        ? prev.filter((type) => type !== sensorType)
        : [...prev, sensorType]
    );
  };

  // 구간 선택 핸들러
  const handleRangeSelect = (start: number, end: number) => {
    setSelectedRange({ start, end });
  };

  // 실시간 센서 데이터 수신 핸들러
  const handleNewSensorData = useCallback(
    (newData: SensorData) => {
      // 선택된 AMR이 있고, 데이터가 해당 AMR의 것이 아니면 무시
      if (selectedAMR !== "all" && newData.deviceId !== selectedAMR) {
        return;
      }

      // 실시간 모드가 활성화된 경우에만 데이터 추가
      if (realtimeEnabled) {
        setSensorData((prev) => {
          // 중복 데이터 방지 (같은 타임스탬프, 디바이스, 센서 타입)
          const exists = prev.some(
            (item) =>
              item.timestamp === newData.timestamp &&
              item.deviceId === newData.deviceId &&
              item.sensorType === newData.sensorType
          );

          if (exists) return prev;

          // 새 데이터를 맨 앞에 추가하고 최대 1000개까지만 유지
          const updated = [newData, ...prev].slice(0, 1000);
          return updated;
        });
      }
    },
    [selectedAMR, realtimeEnabled]
  );

  // WebSocket 연결
  const {
    connected: wsConnected,
    reconnecting: wsReconnecting,
    error: wsError,
    reconnect: wsReconnect,
  } = useTimelineWebSocket({
    autoConnect: realtimeEnabled,
    onNewSensorData: handleNewSensorData,
    onConnectionChange: (connected) => {
      console.log("Timeline WebSocket 연결 상태:", connected);
    },
  });

  // 다운로드 핸들러
  const handleDownload = async () => {
    // AMR이 선택되지 않은 경우
    if (selectedAMR === "all") {
      setError("다운로드할 AMR 장비를 선택해주세요.");
      return;
    }

    setDownloading(true);
    setError(null);

    try {
      // 현재 시간 기준 24시간 데이터
      const endTime = Date.now();
      const startTime = endTime - 24 * 60 * 60 * 1000;

      // 다운로드 API 호출
      const params = new URLSearchParams({
        startTs: startTime.toString(),
        endTs: endTime.toString(),
        deviceId: selectedAMR,
      });

      const response = await fetch(`${API_BASE}/data/download?${params}`);

      if (!response.ok) {
        throw new Error(`다운로드 실패: ${response.status}`);
      }

      // 파일명 추출 (Content-Disposition 헤더에서)
      const contentDisposition = response.headers.get("content-disposition");
      let filename = `sensor-data-${selectedAMR}-${Date.now()}.csv`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Blob으로 변환 후 다운로드
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("다운로드 실패:", error);
      setError(
        error instanceof Error ? error.message : "다운로드에 실패했습니다"
      );
    } finally {
      setDownloading(false);
    }
  };

  // 센서 타입별 색상 매핑
  const getSensorColor = (sensorType: string) => {
    const colors: Record<string, string> = {
      accelerometer: "bg-blue-100 text-blue-800",
      gyroscope: "bg-green-100 text-green-800",
      gps: "bg-yellow-100 text-yellow-800",
      temperature: "bg-red-100 text-red-800",
      battery: "bg-purple-100 text-purple-800",
      magnetometer: "bg-indigo-100 text-indigo-800",
      microphone: "bg-orange-100 text-orange-800",
    };
    return colors[sensorType] || "bg-gray-100 text-gray-800";
  };

  // 값 포맷팅
  const formatValue = (sensorType: string, value: any) => {
    switch (sensorType) {
      case "accelerometer":
      case "gyroscope":
      case "magnetometer":
        return `x:${value.x?.toFixed(2)} y:${value.y?.toFixed(
          2
        )} z:${value.z?.toFixed(2)}`;
      case "gps":
        return `${value.latitude?.toFixed(4)}, ${value.longitude?.toFixed(4)}`;
      case "temperature":
        return `${value.value?.toFixed(1)}°C`;
      case "battery":
        const batteryInfo = [`${value.level}%`];
        if (value.temperature)
          batteryInfo.push(`${value.temperature.toFixed(1)}°C`);
        if (value.voltage) batteryInfo.push(`${value.voltage.toFixed(0)}mV`);
        return batteryInfo.join(" ");
      case "microphone":
        return `${value.decibel?.toFixed(
          1
        )}dB (max: ${value.maxDecibel?.toFixed(1)}dB)`;
      default:
        return JSON.stringify(value);
    }
  };

  // 사용 가능한 센서 타입 목록 계산
  const availableSensorTypes = Array.from(
    new Set(sensorData.map((d) => d.sensorType))
  ).sort();

  // 현재 선택된 AMR의 통계 계산
  const getCurrentStats = () => {
    if (!summaryData) return null;

    if (selectedAMR === "all") {
      return {
        totalRecords: summaryData.total.totalRecords,
        activeDevices: summaryData.total.totalDevices,
        avgSampling: Math.floor(summaryData.total.totalRecords / (24 * 3600)), // 대략적인 Hz
        dataSize: (summaryData.total.totalRecords * 0.1).toFixed(1), // 추정 크기
      };
    } else {
      const deviceData = summaryData.byDevice[selectedAMR];
      if (!deviceData) return null;

      return {
        totalRecords: deviceData.totalRecords,
        activeDevices: 1,
        avgSampling: Math.floor(deviceData.totalRecords / (24 * 3600)),
        dataSize: (deviceData.totalRecords * 0.1).toFixed(1),
      };
    }
  };

  const stats = getCurrentStats();

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">타임라인</h2>
        <p className="text-muted-foreground">
          수집된 센서 데이터를 시간순으로 확인하고 분석합니다.
        </p>
      </div>

      {/* 컨트롤 바 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* 필터 컨트롤 */}
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <Select value={selectedAMR} onValueChange={setSelectedAMR}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="AMR 장비 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 AMR</SelectItem>
                  {summaryData &&
                    Object.keys(summaryData.byDevice).map((deviceId) => (
                      <SelectItem key={deviceId} value={deviceId}>
                        {deviceId}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  최근 24시간
                </span>
              </div>
            </div>

            {/* 뷰 모드 전환 및 액션 버튼 */}
            <div className="flex items-center gap-2">
              {/* 실시간 연결 상태 및 토글 */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRealtimeEnabled(!realtimeEnabled)}
                  className={`gap-2 ${
                    wsConnected && realtimeEnabled
                      ? "border-green-500 text-green-700 bg-green-50"
                      : wsReconnecting
                      ? "border-yellow-500 text-yellow-700 bg-yellow-50"
                      : "border-gray-300"
                  }`}
                >
                  {wsConnected && realtimeEnabled ? (
                    <Wifi className="h-4 w-4" />
                  ) : wsReconnecting ? (
                    <RotateCcw className="h-4 w-4 animate-spin" />
                  ) : (
                    <WifiOff className="h-4 w-4" />
                  )}
                  {wsConnected && realtimeEnabled
                    ? "실시간"
                    : wsReconnecting
                    ? "재연결중"
                    : "오프라인"}
                </Button>
                {wsError && !wsReconnecting && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={wsReconnect}
                    className="gap-1 text-xs px-2"
                  >
                    재연결
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                className="gap-2"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                새로고침
              </Button>

              <div className="flex rounded-lg border p-1">
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="gap-2"
                >
                  <List className="h-4 w-4" />
                  리스트
                </Button>
                <Button
                  variant={viewMode === "graph" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("graph")}
                  className="gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  그래프
                </Button>
              </div>

              <Button
                variant="outline"
                className="gap-2"
                onClick={handleDownload}
                disabled={downloading || selectedAMR === "all"}
              >
                <Download
                  className={`h-4 w-4 ${downloading ? "animate-pulse" : ""}`}
                />
                {downloading ? "다운로드 중..." : "다운로드"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 에러 표시 */}
      {(error || wsError) && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="space-y-2">
              {error && (
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  <span>API 오류: {error}</span>
                </div>
              )}
              {wsError && (
                <div className="flex items-center gap-2 text-red-700">
                  <WifiOff className="h-4 w-4" />
                  <span>실시간 연결 오류: {wsError}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 타임라인 뷰 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            센서 데이터 타임라인
            {wsConnected && realtimeEnabled && (
              <Badge
                variant="outline"
                className="text-green-700 border-green-500"
              >
                <Wifi className="h-3 w-3 mr-1" />
                실시간
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            {viewMode === "list" ? "시간순 데이터 목록" : "시계열 그래프 분석"}
            {loading && " (로딩 중...)"}
            {wsConnected &&
              realtimeEnabled &&
              " • 새 데이터가 자동으로 추가됩니다"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">데이터를 불러오는 중...</p>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-4">
              {sensorData.length > 0 ? (
                <div className="space-y-2">
                  {sensorData.map((data) => (
                    <div
                      key={data.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        <Badge className={getSensorColor(data.sensorType)}>
                          {data.sensorType}
                        </Badge>
                        <div>
                          <div className="font-medium">{data.deviceId}</div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(data.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-mono">
                        {formatValue(data.sensorType, data.value)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-muted-foreground">
                    <p className="text-lg mb-2">데이터가 없습니다</p>
                    <p className="text-sm">
                      {selectedAMR === "all"
                        ? "현재 선택된 시간 범위에 데이터가 없습니다."
                        : `${selectedAMR}에서 수집된 데이터가 없습니다.`}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* 센서 타입 선택 */}
              <div className="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="text-sm font-medium">표시할 센서:</div>
                {availableSensorTypes.map((sensorType) => (
                  <div key={sensorType} className="flex items-center space-x-2">
                    <Checkbox
                      id={sensorType}
                      checked={selectedSensorTypes.includes(sensorType)}
                      onCheckedChange={() => handleSensorTypeToggle(sensorType)}
                    />
                    <label
                      htmlFor={sensorType}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      <Badge className={getSensorColor(sensorType)}>
                        {sensorType}
                      </Badge>
                    </label>
                  </div>
                ))}
              </div>

              {/* 차트 */}
              {sensorData.length > 0 ? (
                <TimelineChart
                  data={sensorData}
                  sensorTypes={selectedSensorTypes}
                  onRangeSelect={handleRangeSelect}
                  height={400}
                />
              ) : (
                <div className="h-[400px] flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-center text-muted-foreground">
                    <p className="text-lg mb-2">데이터가 없습니다</p>
                    <p className="text-sm">
                      {selectedAMR === "all"
                        ? "AMR을 선택하여 데이터를 조회하세요."
                        : "선택된 시간 범위에 데이터가 없습니다."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 데이터 요약 통계 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">총 레코드</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalRecords?.toLocaleString() || 0}
            </div>
            <p className="text-xs text-muted-foreground">전체 데이터 포인트</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">활성 AMR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.activeDevices || 0}
            </div>
            <p className="text-xs text-muted-foreground">데이터 수신 중</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">평균 샘플링</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avgSampling || 0} Hz
            </div>
            <p className="text-xs text-muted-foreground">초당 데이터</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">데이터 크기</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.dataSize || 0} KB</div>
            <p className="text-xs text-muted-foreground">저장된 용량</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
