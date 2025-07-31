"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  Database,
  Smartphone,
  Timer,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/features/dashboard/stores/dashboardStore";
import { useDashboardPolling } from "@/features/dashboard/hooks/useDashboardPolling";
import { useDashboardWebSocket } from "@/features/dashboard/hooks/useDashboardWebSocket";
import { useDashboardNotifications } from "@/features/dashboard/hooks/useDashboardNotifications";
import { RealtimeChart } from "@/features/dashboard/components/RealtimeChart";
import NoSSR from "@/components/NoSSR";

export default function DashboardPage() {
  const {
    serverStatus,
    dataSummary,
    connectedDevices,
    realtimeStats,
    loading,
    errors,
    wsConnected,
    wsReconnecting,
  } = useDashboardStore();

  // 실시간 차트 데이터
  const [chartData, setChartData] = useState<number[]>([]);

  // 폴링 시작
  useDashboardPolling({ enabled: true });

  // WebSocket 연결
  const { sendMessage } = useDashboardWebSocket({
    autoConnect: true,
    onMessage: (message) => {
      // 추가 메시지 처리
      console.log("Dashboard received message:", message);
    },
  });

  // 알림 활성화
  useDashboardNotifications({
    enabled: true,
    showDeviceConnections: true,
    showErrors: true,
    showStats: false, // 통계 알림은 비활성화 (너무 자주 표시될 수 있음)
  });

  // 실시간 차트 데이터 업데이트
  useEffect(() => {
    const interval = setInterval(() => {
      setChartData([realtimeStats.packetsPerSecond]);
    }, 1000);

    return () => clearInterval(interval);
  }, [realtimeStats.packetsPerSecond]);

  // 서버 가동 시간 계산
  const getUptime = useCallback(() => {
    if (!serverStatus?.startTime) return "0분";

    const uptime = Date.now() - serverStatus.startTime;
    const minutes = Math.floor(uptime / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}일 ${hours % 24}시간`;
    } else if (hours > 0) {
      return `${hours}시간 ${minutes % 60}분`;
    } else {
      return `${minutes}분`;
    }
  }, [serverStatus?.startTime]);

  // 수동 새로고침
  const handleRefresh = () => {
    const { fetchServerStatus, fetchDataSummary, fetchConnectedDevices } =
      useDashboardStore.getState();
    fetchServerStatus();
    fetchDataSummary();
    fetchConnectedDevices();
  };

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">대시보드</h2>
          <p className="text-muted-foreground">
            AMR QC 솔루션의 실시간 상태를 모니터링합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* WebSocket 연결 상태 */}
          <NoSSR>
            <Badge
              variant={
                wsConnected
                  ? "default"
                  : wsReconnecting
                  ? "secondary"
                  : "destructive"
              }
            >
              {wsConnected ? (
                <>
                  <Wifi className="mr-1 h-3 w-3" />
                  실시간 연결됨
                </>
              ) : wsReconnecting ? (
                <>
                  <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                  재연결 중...
                </>
              ) : (
                <>
                  <WifiOff className="mr-1 h-3 w-3" />
                  연결 끊김
                </>
              )}
            </Badge>
          </NoSSR>

          {/* 새로고침 버튼 */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading.serverStatus || loading.dataSummary}
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading.serverStatus ? "animate-spin" : ""
              }`}
            />
          </Button>
        </div>
      </div>

      {/* 상태 카드 그리드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              연결된 스마트폰
            </CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading.serverStatus ? (
                <span className="text-muted-foreground">-</span>
              ) : (
                serverStatus?.websocket.connections || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">현재 활성 연결</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">수집된 데이터</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading.dataSummary ? (
                <span className="text-muted-foreground">-</span>
              ) : (
                dataSummary?.total.totalRecords?.toLocaleString() || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">총 레코드 수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">실시간 처리율</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {realtimeStats.packetsPerSecond.toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">패킷/초</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              서버 가동 시간
            </CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getUptime()}</div>
            <p className="text-xs text-muted-foreground">연속 가동 중</p>
          </CardContent>
        </Card>
      </div>

      {/* 실시간 차트 섹션 */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>실시간 데이터 스트림</CardTitle>
            <CardDescription>최근 20초간의 데이터 수신 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <NoSSR>
              <RealtimeChart
                data={chartData}
                label="패킷/초"
                color="rgb(59, 130, 246)"
                height={200}
                maxDataPoints={20}
              />
            </NoSSR>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>디바이스 상태</CardTitle>
            <CardDescription>연결된 디바이스 목록</CardDescription>
          </CardHeader>
          <CardContent>
            {loading.devices ? (
              <div className="text-sm text-muted-foreground">로딩 중...</div>
            ) : errors.devices ? (
              <div className="flex items-center text-sm text-destructive">
                <AlertCircle className="mr-2 h-4 w-4" />
                {errors.devices}
              </div>
            ) : connectedDevices.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                연결된 디바이스가 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {connectedDevices.map((device) => (
                  <div
                    key={device.deviceId}
                    className="flex items-center justify-between rounded-lg border p-2"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          device.status === "connected"
                            ? "bg-green-500"
                            : "bg-gray-300"
                        }`}
                      />
                      <span className="text-sm font-medium">
                        {device.deviceId}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {device.messageCount} 메시지
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 빠른 액션 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle>빠른 액션</CardTitle>
          <CardDescription>
            자주 사용하는 기능들에 빠르게 접근하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // Mock 데이터 생성 요청
                sendMessage({
                  type: "request_mock_data",
                  data: { count: 10 },
                });
              }}
            >
              테스트 데이터 생성
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // 데이터 다운로드 페이지로 이동
                window.location.href = "/timeline";
              }}
            >
              데이터 다운로드
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // 서버 연결 페이지로 이동
                window.location.href = "/connection";
              }}
            >
              QR 코드 보기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
