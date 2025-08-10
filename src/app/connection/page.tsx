"use client";

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
  Copy,
  Wifi,
  Smartphone,
  Activity,
  X,
  Play,
  Square,
  Clock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useServerInfo } from "@/hooks/useServerInfo";
import { useConnectedDevices } from "@/hooks/useConnectedDevices";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { AMRQRCodeGenerator } from "@/components/AMRQRCodeGenerator";
import { useTheme } from "next-themes";
import { ConnectionTopology } from "@/features/connection/components/ConnectionTopology";

export default function ConnectionPage() {
  const { toast } = useToast();
  const { theme } = useTheme();
  const { serverInfo, serverStatus, loading, error } = useServerInfo();
  const { devices } = useConnectedDevices();

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      description: `${label}이(가) 클립보드에 복사되었습니다.`,
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

  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 ${hours % 24}시간`;
    if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
    if (minutes > 0) return `${minutes}분 ${seconds % 60}초`;
    return `${seconds}초`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const isServerOnline = serverStatus?.websocket?.connected ?? false;
  const serverConnections = serverStatus?.websocket?.connections ?? 0;
  const viewerOnline = true;

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">연결</h2>
        </div>
        <AMRQRCodeGenerator />
      </div>

      {/* 서버 상태 배너 */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">서버 연결 오류: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* 서버 연결 정보 카드 */}
      <Card>
        <CardHeader>
          <CardTitle>서버 연결 정보</CardTitle>
          <CardDescription>
            스마트폰에서 QR 코드를 스캔하거나 WebSocket 주소를 직접 입력하여
            서버에 연결하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 lg:grid-cols-2">
            {/* QR 코드 섹션 */}
            <div className="flex flex-col items-center space-y-1">
              <label className="text-sm font-medium">QR 코드로 빠른 연결</label>
              {loading ? (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 flex items-center justify-center">
                  <div className="text-center space-y-2">
                    <Wifi className="h-12 w-12 mx-auto text-gray-400 animate-pulse" />
                    <p className="text-sm text-muted-foreground">
                      QR 코드 생성 중...
                    </p>
                  </div>
                </div>
              ) : serverInfo ? (
                <div className="space-y-4">
                  <QRCodeDisplay
                    value={serverInfo.urls.websocket}
                    size={240}
                    darkColor={theme === "dark" ? "#ffffff" : "#000000"}
                    lightColor={theme === "dark" ? "#1f2937" : "#ffffff"}
                  />
                  <p className="text-xs text-center text-muted-foreground max-w-[240px]">
                    스마트폰 카메라로 스캔하여 빠르게 연결
                  </p>
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">
                    서버 정보를 불러올 수 없습니다.
                  </p>
                </div>
              )}
            </div>

            {/* 서버 상세 정보 섹션 */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">WebSocket 주소</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={serverInfo?.urls.websocket || "연결 중..."}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      serverInfo &&
                      handleCopy(serverInfo.urls.websocket, "WebSocket 주소")
                    }
                    disabled={!serverInfo}
                    title="복사"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">서버 상태</label>
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      isServerOnline
                        ? "bg-green-500 animate-pulse"
                        : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm">
                    {isServerOnline ? "연결 가능" : "연결 불가"}
                  </span>
                  {serverStatus && serverStatus.uptime > 0 && (
                    <span className="text-sm text-muted-foreground">
                      (가동 시간: {formatUptime(serverStatus.uptime)})
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">네트워크 정보</label>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>호스트명: {serverInfo?.network.hostname || "-"}</p>
                  <p>IP 주소: {serverInfo?.network.primaryIP || "-"}</p>
                  <p>WebSocket 포트: {serverInfo?.ports.websocket || "-"}</p>
                  <p>HTTP API 포트: {serverInfo?.ports.http || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 연결 토폴로지 */}
      <ConnectionTopology
        serverOnline={isServerOnline}
        viewerOnline={viewerOnline}
        devices={devices
          .filter((d) => !d.deviceId?.startsWith("unregistered-"))
          .map((d) => ({
            id: d.id,
            deviceId: d.deviceId,
            status: d.status,
            connectedAt: d.connectedAt,
            messageCount: d.messageCount,
            sessionId: d.sessionId,
            hasActiveSession: d.hasActiveSession,
          }))}
      />

      {/* 연결된 스마트폰 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>연결된 스마트폰</span>
            <Badge variant="secondary" className="font-semibold">
              {
                devices.filter((d) => !d.deviceId?.startsWith("unregistered-"))
                  .length
              }
              대 연결됨
            </Badge>
          </CardTitle>
          <CardDescription>
            현재 서버에 연결된 스마트폰 목록입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.filter((d) => !d.deviceId?.startsWith("unregistered-"))
            .length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="relative mx-auto w-24 h-24 mb-4">
                <Smartphone className="h-12 w-12 mx-auto opacity-30" />
                <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <X className="h-3 w-3 text-red-500" />
                </div>
              </div>
              <h3 className="font-medium text-lg mb-2">
                연결된 스마트폰이 없습니다
              </h3>
              <p className="text-sm">
                스마트폰에서 QR 코드를 스캔하여 연결하세요.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {devices
                .filter((d) => !d.deviceId?.startsWith("unregistered-"))
                .map((device) => (
                  <Card
                    key={device.id}
                    className="relative border-2 hover:border-primary/20 transition-colors"
                  >
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* 디바이스 헤더 */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="relative">
                              <Smartphone className="h-5 w-5 text-blue-600" />
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-sm">
                                {device.deviceId}
                              </h4>
                              <p className="text-xs text-muted-foreground">
                                Client ID: {device.id.slice(-8)}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => disconnectDevice(device.deviceId)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            title="연결 해제"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* 세션 상태 */}
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          {device.hasActiveSession ? (
                            <>
                              <Play className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                                활성 세션
                              </span>
                              {device.sessionId && (
                                <Badge
                                  variant="outline"
                                  className="text-xs font-mono"
                                >
                                  {device.sessionId.slice(-8)}
                                </Badge>
                              )}
                            </>
                          ) : (
                            <>
                              <Square className="h-4 w-4 text-gray-500" />
                              <span className="text-sm text-muted-foreground">
                                대기 중
                              </span>
                            </>
                          )}
                        </div>

                        {/* 연결 정보 */}
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>연결 시간</span>
                            </div>
                            <span className="font-mono">
                              {formatTime(device.connectedAt)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              <span>수신 메시지</span>
                            </div>
                            <span className="font-mono">
                              {device.messageCount.toLocaleString()}개
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Wifi className="h-3 w-3" />
                              <span>마지막 활동</span>
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
                          <div className="flex items-center gap-2">
                            <div
                              className={`h-2 w-2 rounded-full ${
                                device.status === "connected"
                                  ? "bg-green-500 animate-pulse"
                                  : "bg-gray-400"
                              }`}
                            />
                            <span className="text-xs font-medium">
                              {device.status === "connected"
                                ? "연결됨"
                                : "연결 끊김"}
                            </span>
                          </div>

                          {device.hasActiveSession && (
                            <Badge variant="secondary" className="text-xs">
                              데이터 수집 중
                            </Badge>
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

      {/* 연결 가이드 */}
      <Card>
        <CardHeader>
          <CardTitle>연결 가이드</CardTitle>
          <CardDescription>
            스마트폰을 서버에 연결하는 방법입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>
              스마트폰과 서버가 같은 네트워크에 연결되어 있는지 확인하세요.
            </li>
            <li>스마트폰에서 AMR QC 앱을 실행합니다.</li>
            <li>위의 QR 코드를 스캔하거나 WebSocket 주소를 직접 입력합니다.</li>
            <li>
              연결 성공 메시지가 표시되면 AMR 장비의 QR 코드를 스캔합니다.
            </li>
            <li>데이터 전송이 자동으로 시작됩니다.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
