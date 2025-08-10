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
  Smartphone,
  Timer,
  RefreshCw,
  Activity,
  TrendingUp,
  Play,
  Square,
  Clock,
  Wifi,
  X,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDashboardStore } from "@/features/dashboard/stores/dashboardStore";
import { useDashboardPolling } from "@/features/dashboard/hooks/useDashboardPolling";
import { useDashboardWebSocket } from "@/features/dashboard/hooks/useDashboardWebSocket";
import { useDashboardNotifications } from "@/features/dashboard/hooks/useDashboardNotifications";
// 실시간 차트 및 NoSSR 컴포넌트 제거 (요구사항에 따라 대시보드에서 미사용)
import { useToast } from "@/hooks/use-toast";
import { useServerInfo } from "@/hooks/useServerInfo";

export default function DashboardPage() {
  const {
    serverStatus,
    dataSummary,
    connectedDevices,
    realtimeStats,
    loading,
    errors,
  } = useDashboardStore();

  const { toast } = useToast();
  const { serverInfo } = useServerInfo();

  // 실시간 차트 제거로 관련 상태 제거

  // 폴링 시작
  useDashboardPolling({ enabled: true });

  // WebSocket 연결 (대시보드에서는 자동 연결하지 않음)
  // Mock 데이터는 /mock 페이지에서 관리
  useDashboardWebSocket({
    autoConnect: false, // 자동 연결 비활성화
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

  // 실시간 차트 제거로 관련 효과 제거

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

  // 시간 포맷팅 헬퍼
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // 디바이스 강제 연결 해제
  const disconnectDevice = async (deviceId: string) => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/api/server/disconnect-device`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "연결 해제 성공",
          description: `${deviceId} 디바이스의 연결이 해제되었습니다.`,
        });
      } else {
        throw new Error(result.error || "연결 해제에 실패했습니다.");
      }
    } catch (error) {
      console.error("Device disconnect error:", error);
      toast({
        title: "연결 해제 실패",
        description:
          error instanceof Error
            ? error.message
            : "알 수 없는 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
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
        {/* 서버 연결 정보 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">서버 연결</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {serverStatus?.websocket?.connected ? (
                <span className="text-green-600">온라인</span>
              ) : (
                <span className="text-red-600">오프라인</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {serverInfo?.network.primaryIP || "127.0.0.1"}:
              {serverInfo?.ports.websocket || 8001}
            </p>
          </CardContent>
        </Card>
        {/* 서버 가동 시간 */}
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

        {/* 활성 디바이스 수 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 디바이스</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading.devices
                ? "..."
                : connectedDevices.filter(
                    (d) => !d.deviceId?.startsWith("unregistered-")
                  ).length}
            </div>
            <p className="text-xs text-muted-foreground">대 연결됨</p>
          </CardContent>
        </Card>

        {/* 메시지 수신 통계 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">메시지 수신</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading.serverStatus
                ? "..."
                : (
                    serverStatus?.websocket?.messagesReceived || 0
                  ).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">총 수신된 메시지</p>
          </CardContent>
        </Card>
      </div>

      {/* 연결된 스마트폰 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>연결된 스마트폰</span>
            <Badge variant="secondary" className="font-semibold">
              {
                connectedDevices.filter(
                  (d) => !d.deviceId?.startsWith("unregistered-")
                ).length
              }
              대 연결됨
            </Badge>
          </CardTitle>
          <CardDescription>
            현재 서버에 연결된 스마트폰 목록과 실시간 상태입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {connectedDevices.filter(
            (d) => !d.deviceId?.startsWith("unregistered-")
          ).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="relative mx-auto w-16 h-16 mb-4">
                <Smartphone className="h-8 w-8 mx-auto opacity-30" />
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <X className="h-2 w-2 text-red-500" />
                </div>
              </div>
              <h3 className="font-medium mb-2">연결된 스마트폰이 없습니다</h3>
              <p className="text-sm">
                연결 페이지에서 QR 코드를 스캔하여 디바이스를 연결하세요.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {connectedDevices
                .filter((d) => !d.deviceId?.startsWith("unregistered-"))
                .map((device) => (
                  <Card
                    key={device.id}
                    className="relative border hover:border-primary/30 transition-colors"
                  >
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        {/* 디바이스 헤더 */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="relative">
                              <Smartphone className="h-4 w-4 text-blue-600" />
                              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            </div>
                            <div>
                              <h4 className="font-medium text-sm">
                                {device.deviceId}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                ID: {device.id.slice(-6)}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => disconnectDevice(device.deviceId)}
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            title="연결 해제"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>

                        {/* 세션 상태 */}
                        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                          {device.hasActiveSession ? (
                            <>
                              <Play className="h-3 w-3 text-green-600" />
                              <span className="text-xs font-medium text-green-700 dark:text-green-400">
                                데이터 수집 중
                              </span>
                              {device.sessionId && (
                                <Badge
                                  variant="outline"
                                  className="text-xs font-mono py-0 px-1 h-4"
                                >
                                  {device.sessionId.slice(-6)}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <>
                              <Square className="h-3 w-3 text-gray-500" />
                              <span className="text-xs text-muted-foreground">
                                대기 중
                              </span>
                            </>
                          )}
                        </div>

                        {/* 연결 정보 */}
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>연결</span>
                            </div>
                            <span className="font-mono">
                              {formatTime(device.connectedAt)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Activity className="h-3 w-3" />
                              <span>메시지</span>
                            </div>
                            <span className="font-mono text-green-600">
                              {device.messageCount.toLocaleString()}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Wifi className="h-3 w-3" />
                              <span>활동</span>
                            </div>
                            <span className="font-mono">
                              {device.lastActivity
                                ? formatTime(device.lastActivity)
                                : "-"}
                            </span>
                          </div>
                        </div>

                        {/* 상태 표시 */}
                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-1.5">
                            <div
                              className={`h-1.5 w-1.5 rounded-full ${
                                device.status === "connected"
                                  ? "bg-green-500 animate-pulse"
                                  : "bg-gray-400"
                              }`}
                            />
                            <span className="text-xs font-medium">
                              {device.status === "connected"
                                ? "온라인"
                                : "오프라인"}
                            </span>
                          </div>

                          {device.hasActiveSession && (
                            <div className="flex items-center gap-1">
                              <div className="h-1 w-1 bg-green-500 rounded-full animate-pulse" />
                              <span className="text-xs text-green-600">
                                수집 중
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
