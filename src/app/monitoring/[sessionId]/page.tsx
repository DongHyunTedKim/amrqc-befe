"use client";

import { useState, useEffect, useCallback, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff,
  RotateCcw,
  BarChart3,
  Table2,
  Calendar,
  Clock,
  Database,
  Activity,
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useMonitoringWebSocket } from "@/features/monitoring/hooks/useMonitoringWebSocket";
import { useMonitoringStore } from "@/features/monitoring/stores/monitoringStore";

// 동적 로딩 컴포넌트
const MonitoringChart = dynamic(
  () =>
    import("@/features/monitoring/components/MonitoringChart").then(
      (m) => m.MonitoringChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="text-muted-foreground">차트 로딩 중...</div>
      </div>
    ),
  }
);

// 타입 정의
interface SessionData {
  sessionId: string;
  deviceId: string;
  status: "active" | "completed" | "error" | "paused";
  startTime: number;
  endTime?: number | null;
  dataCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface SensorData {
  id: number;
  deviceId: string;
  sessionId?: string; // WebSocket에서 올 때는 있을 수도 없을 수도 있음
  timestamp: number;
  sensorType: string;
  value: any;
  createdAt: string;
}

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default function SessionDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const sessionId = resolvedParams.sessionId;

  const [session, setSession] = useState<SessionData | null>(null);
  const [sensorData, setSensorData] = useState<SensorData[]>([]);
  // 글로벌 스토어
  const monitoringStore = useMonitoringStore();

  const [availableSensors, setAvailableSensors] = useState<string[]>([]);
  const [selectedSensor, setSelectedSensor] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"graph" | "table">("graph");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);

  const API_BASE = "http://localhost:8000/api";

  // 샘플 디바이스 여부 확인
  const isSampleDevice = (deviceId: string) => {
    // AMR-001부터 AMR-005까지와 TEST로 시작하는 디바이스는 샘플로 간주
    return /^AMR-00[1-5]$/.test(deviceId) || deviceId.startsWith("TEST");
  };

  // 디바이스 표시명 생성
  const getDeviceDisplayName = (deviceId: string) => {
    return isSampleDevice(deviceId) ? `${deviceId} (SAMPLE)` : deviceId;
  };

  // 세션 정보 조회
  const fetchSessionInfo = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/sessions/${sessionId}`);
      if (!response.ok) {
        throw new Error(`세션 조회 실패: ${response.status}`);
      }
      const result = await response.json();
      if (result.success && result.data) {
        setSession(result.data);
      }
    } catch (error) {
      console.error("세션 정보 조회 실패:", error);
      setError(error instanceof Error ? error.message : "세션 정보 조회 실패");
    }
  }, [sessionId]);

  // 센서 데이터 조회
  const fetchSensorData = useCallback(
    async (sensorType?: string) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.append("limit", "1000");

        if (sensorType) {
          params.append("sensorType", sensorType);
        }

        const response = await fetch(
          `${API_BASE}/sessions/${sessionId}/data?${params}`
        );

        if (!response.ok) {
          throw new Error(`데이터 조회 실패: ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
          setSensorData(result.data || []);

          // 스토어에 히스토리 반영 (센서별)
          if (Array.isArray(result.data)) {
            const byType: Record<string, SensorData[]> = {};
            for (const row of result.data) {
              const key = row.sensorType;
              if (!byType[key]) byType[key] = [];
              byType[key].push(row);
            }
            Object.entries(byType).forEach(([type, list]) => {
              monitoringStore.replaceHistory(sessionId, type, list);
            });
          }

          // 세션 정보 업데이트
          if (result.session) {
            setSession(result.session);
          }

          // 사용 가능한 센서 타입 추출
          if (!sensorType) {
            const sensorTypes = new Set<string>(
              result.data.map((d: SensorData) => d.sensorType as string)
            );
            const sortedSensors: string[] = Array.from(sensorTypes).sort();

            // 데이터가 없는 경우 기본 센서 타입 목록 제공
            const defaultSensors = [
              "accelerometer",
              "gyroscope",
              "gps",
              "temperature",
              "battery",
              "magnetometer",
              "microphone",
            ];

            const finalSensors =
              sortedSensors.length > 0 ? sortedSensors : defaultSensors;
            setAvailableSensors(finalSensors);

            // 첫 번째 센서를 기본 선택 (데이터가 있는 경우에만)
            if (sortedSensors.length > 0 && !selectedSensor) {
              setSelectedSensor(sortedSensors[0] as string);
            } else if (sortedSensors.length === 0) {
              // 데이터가 없는 경우 선택 해제
              setSelectedSensor(null);
            }
          }
        }
      } catch (error) {
        console.error("센서 데이터 조회 실패:", error);
        setError(error instanceof Error ? error.message : "데이터 조회 실패");
      } finally {
        setLoading(false);
      }
    },
    [sessionId, selectedSensor]
  );

  // 실시간 데이터 수신 핸들러
  const handleNewSensorData = useCallback(
    (newData: SensorData) => {
      // 현재 세션의 데이터만 처리 (sessionId가 있는 경우에만 체크)
      if (newData.sessionId && newData.sessionId !== sessionId) return;

      setSensorData((prev) => {
        // 중복 방지
        const exists = prev.some(
          (item) =>
            item.timestamp === newData.timestamp &&
            item.sensorType === newData.sensorType
        );

        if (exists) return prev;

        // 최신 데이터를 앞에 추가하고 최대 1000개 유지
        const dataWithSession = { ...newData, sessionId };
        return [dataWithSession, ...prev].slice(0, 1000);
      });

      // 스토어에도 추가 (세션 유지)
      const dataWithSession = { ...newData, sessionId } as SensorData;
      monitoringStore.appendLive(sessionId, dataWithSession);
    },
    [sessionId]
  );

  // WebSocket 연결
  const {
    connected: wsConnected,
    reconnecting: wsReconnecting,
    error: wsError,
    reconnect: wsReconnect,
  } = useMonitoringWebSocket({
    autoConnect: realtimeEnabled && session?.status === "active",
    onNewSensorData: handleNewSensorData,
    onConnectionChange: (connected) => {
      console.log("세션 상세 WebSocket 연결 상태:", connected);
    },
  });

  // CSV 다운로드 (세션별 전용 API 사용)
  const handleDownload = async () => {
    setDownloading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      // 선택된 센서가 있으면 해당 센서만 다운로드
      if (selectedSensor) {
        params.append("sensorType", selectedSensor);
      }
      params.append("format", "csv");

      const response = await fetch(
        `${API_BASE}/sessions/${sessionId}/download?${params}`
      );

      if (!response.ok) {
        throw new Error(`다운로드 실패: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;

      // 파일명 생성 (센서 타입 포함)
      const sensorSuffix = selectedSensor ? `-${selectedSensor}` : "";
      const sessionShortId = sessionId.split("-").slice(-1)[0];
      a.download = `session-${
        session?.deviceId
      }-${sessionShortId}${sensorSuffix}-${format(
        new Date(),
        "yyyyMMdd-HHmmss"
      )}.csv`;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("다운로드 실패:", error);
      setError(error instanceof Error ? error.message : "다운로드 실패");
    } finally {
      setDownloading(false);
    }
  };

  // 센서 선택 변경 시 데이터 재조회
  useEffect(() => {
    if (selectedSensor) {
      fetchSensorData(selectedSensor);
    }
  }, [selectedSensor, fetchSensorData]);

  // 컴포넌트 마운트 시 초기 데이터 로드
  useEffect(() => {
    fetchSessionInfo();
    fetchSensorData();
  }, [fetchSessionInfo]);

  // 센서별 색상
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
        return `${value.level}% (${value.temperature?.toFixed(1)}°C)`;
      case "microphone":
        return `${value.decibel?.toFixed(1)}dB`;
      default:
        return JSON.stringify(value);
    }
  };

  // 필터링된 센서 데이터
  const filteredSensorData = useMemo(() => {
    // 스토어에서 세션 전체 + 선택 센서 기준으로 조회 (페이지 이동 후에도 유지)
    return monitoringStore.getData(sessionId, selectedSensor || undefined);
  }, [monitoringStore, sessionId, selectedSensor, sensorData]);

  // 세션 상태 배지
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return { color: "bg-green-100 text-green-800", label: "수집 중" };
      case "completed":
        return { color: "bg-blue-100 text-blue-800", label: "완료" };
      case "error":
        return { color: "bg-red-100 text-red-800", label: "오류" };
      case "paused":
        return { color: "bg-yellow-100 text-yellow-800", label: "일시정지" };
      default:
        return { color: "bg-gray-100 text-gray-800", label: status };
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/monitoring")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              세션 상세 정보
              {session && isSampleDevice(session.deviceId) && (
                <Badge
                  variant="outline"
                  className="text-xs px-2 py-1 bg-orange-50 text-orange-700 border-orange-200"
                >
                  SAMPLE
                </Badge>
              )}
            </h2>
            <p className="text-muted-foreground">
              {session?.deviceId} - {sessionId.split("-").slice(-1)[0]}
            </p>
          </div>
        </div>
        {session && (
          <Badge className={getStatusBadge(session.status).color}>
            {getStatusBadge(session.status).label}
          </Badge>
        )}
      </div>

      {/* 세션 정보 카드 */}
      {session && (
        <Card>
          <CardHeader>
            <CardTitle>세션 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">디바이스 ID</p>
                <p className="font-medium flex items-center gap-2">
                  {session.deviceId}
                  {isSampleDevice(session.deviceId) && (
                    <Badge
                      variant="outline"
                      className="text-xs px-1.5 py-0.5 bg-orange-50 text-orange-700 border-orange-200"
                    >
                      SAMPLE
                    </Badge>
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">시작 시간</p>
                <p className="font-medium">
                  {format(new Date(session.startTime), "yyyy-MM-dd HH:mm:ss", {
                    locale: ko,
                  })}
                </p>
              </div>
              {session.endTime && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">종료 시간</p>
                  <p className="font-medium">
                    {format(new Date(session.endTime), "yyyy-MM-dd HH:mm:ss", {
                      locale: ko,
                    })}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 에러 표시 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 센서 선택 및 액션 바 */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Part 1: 센서 선택 토글 버튼 그룹 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">센서 선택:</span>
                {availableSensors.length > 0 ? (
                  <div className="flex gap-1 p-1 bg-muted rounded-lg">
                    {availableSensors.map((sensor) => {
                      // 실제 데이터가 있는 센서인지 확인
                      const hasData = sensorData.some(
                        (d) => d.sensorType === sensor
                      );
                      return (
                        <Button
                          key={sensor}
                          variant={
                            selectedSensor === sensor ? "default" : "ghost"
                          }
                          size="sm"
                          onClick={() => setSelectedSensor(sensor)}
                          className={`gap-2 ${!hasData ? "opacity-60" : ""}`}
                          title={
                            hasData
                              ? `${sensor} 센서 데이터 보기`
                              : `${sensor} 센서 데이터 없음`
                          }
                        >
                          <Badge
                            className={`${getSensorColor(sensor)} border-0`}
                          >
                            {sensor}
                          </Badge>
                        </Button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-sm">
                      센서 데이터를 불러오는 중...
                    </span>
                    {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* 실시간 연결 상태 */}
                {session?.status === "active" && (
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
                )}

                {/* 새로고침 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchSensorData(selectedSensor || undefined)}
                  disabled={loading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                  />
                </Button>

                {/* 다운로드 */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  disabled={downloading}
                  className="gap-2"
                >
                  <Download
                    className={`h-4 w-4 ${downloading ? "animate-pulse" : ""}`}
                  />
                  다운로드
                </Button>
              </div>
            </div>

            {/* Part 2: 뷰 모드 토글 */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">보기 모드:</span>
              <div className="flex p-1 bg-muted rounded-lg">
                <Button
                  variant={viewMode === "graph" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("graph")}
                  className="gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  그래프
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                  className="gap-2"
                >
                  <Table2 className="h-4 w-4" />
                  테이블
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 데이터 뷰 */}
      <Card>
        <CardHeader>
          <CardTitle>
            {selectedSensor ? `${selectedSensor} 센서 데이터` : "센서 데이터"}
          </CardTitle>
          <CardDescription>
            {loading
              ? "데이터 로딩 중..."
              : selectedSensor
              ? `${filteredSensorData.length}개 데이터 포인트`
              : "센서를 선택하여 데이터를 확인하세요"}
            {wsConnected &&
              realtimeEnabled &&
              session?.status === "active" &&
              " • 실시간 업데이트 중"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !selectedSensor ? (
            <div className="h-[400px] flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-center text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4" />
                <p className="text-lg mb-2">센서를 선택해주세요</p>
                <p className="text-sm">
                  위의 센서 목록에서 보고 싶은 센서를 클릭하세요.
                </p>
                {sensorData.length === 0 && (
                  <p className="text-xs mt-2 text-orange-600">
                    현재 이 세션에는 수집된 센서 데이터가 없습니다.
                  </p>
                )}
              </div>
            </div>
          ) : viewMode === "graph" ? (
            <div>
              {filteredSensorData.length > 0 ? (
                <MonitoringChart
                  data={filteredSensorData}
                  sensorTypes={
                    selectedSensor ? [selectedSensor] : availableSensors
                  }
                  height={400}
                />
              ) : (
                <div className="h-[400px] flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                    <p className="text-lg mb-2">
                      {selectedSensor} 센서 데이터가 없습니다
                    </p>
                    <p className="text-sm">
                      이 세션에서는 {selectedSensor} 센서의 데이터가 수집되지
                      않았습니다.
                    </p>
                    {session?.status === "active" && (
                      <p className="text-xs mt-2 text-blue-600">
                        실시간 데이터 수집이 활성화되어 있습니다. 데이터가
                        들어오면 자동으로 표시됩니다.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              {filteredSensorData.length > 0 ? (
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium">시간</th>
                      <th className="text-left p-2 font-medium">센서</th>
                      <th className="text-left p-2 font-medium">값</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSensorData.slice(0, 100).map((data) => (
                      <tr key={data.id} className="border-b hover:bg-gray-50">
                        <td className="p-2 text-sm">
                          {format(new Date(data.timestamp), "HH:mm:ss.SSS")}
                        </td>
                        <td className="p-2">
                          <Badge
                            className={`${getSensorColor(
                              data.sensorType
                            )} border-0`}
                          >
                            {data.sensorType}
                          </Badge>
                        </td>
                        <td className="p-2 text-sm font-mono">
                          {formatValue(data.sensorType, data.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Table2 className="h-12 w-12 mx-auto mb-4" />
                  <p className="text-lg mb-2">
                    {selectedSensor} 센서 데이터가 없습니다
                  </p>
                  <p className="text-sm">
                    이 세션에서는 {selectedSensor} 센서의 데이터가 수집되지
                    않았습니다.
                  </p>
                  {session?.status === "active" && (
                    <p className="text-xs mt-2 text-blue-600">
                      실시간 데이터 수집이 활성화되어 있습니다. 데이터가
                      들어오면 자동으로 표시됩니다.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
