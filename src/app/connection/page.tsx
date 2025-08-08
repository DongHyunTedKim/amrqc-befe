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
import { Copy, RefreshCw, Wifi, Smartphone, Activity, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useServerInfo } from "@/hooks/useServerInfo";
import { useConnectedDevices } from "@/hooks/useConnectedDevices";
import { QRCodeDisplay } from "@/components/QRCodeDisplay";
import { useTheme } from "next-themes";

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

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">서버 연결</h2>
        <p className="text-muted-foreground">
          스마트폰에서 아래 QR 코드를 스캔하거나 URL을 입력하여 서버에
          연결하세요.
        </p>
      </div>

      {/* 서버 상태 배너 */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">서버 연결 오류: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* 연결 정보 카드 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>QR 코드</CardTitle>
            <CardDescription>
              스마트폰 카메라로 스캔하여 빠르게 연결하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
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
                  size={280}
                  darkColor={theme === "dark" ? "#ffffff" : "#000000"}
                  lightColor={theme === "dark" ? "#1f2937" : "#ffffff"}
                />
                <p className="text-sm text-center text-muted-foreground">
                  WebSocket URL: {serverInfo.urls.websocket}
                </p>
              </div>
            ) : (
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-8 flex items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  서버 정보를 불러올 수 없습니다.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>서버 정보</CardTitle>
            <CardDescription>
              수동으로 서버에 연결하려면 아래 정보를 사용하세요.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    isServerOnline ? "bg-green-500 animate-pulse" : "bg-red-500"
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

            {serverStatus && serverStatus.websocket.connections > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">연결 통계</label>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>현재 연결: {serverStatus.websocket.connections}개</p>
                  <p>
                    수신 메시지:{" "}
                    {serverStatus.websocket.messagesReceived?.toLocaleString() ||
                      0}
                    개
                  </p>
                  {serverStatus.queue && (
                    <p>패킷 유실률: {serverStatus.queue.lossRate}%</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 연결된 스마트폰 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>연결된 스마트폰</span>
            <Badge variant="secondary">{devices.length}대 연결됨</Badge>
          </CardTitle>
          <CardDescription>
            현재 서버에 연결된 스마트폰 목록입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Smartphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>연결된 스마트폰이 없습니다.</p>
              <p className="text-sm mt-1">
                스마트폰에서 QR 코드를 스캔하여 연결하세요.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {devices.map((device) => (
                <Card key={device.id} className="relative">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4" />
                          <span className="font-medium text-sm">
                            {device.deviceId}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          연결 시간: {formatTime(device.connectedAt)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          수신 메시지: {device.messageCount.toLocaleString()}개
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity
                          className={`h-4 w-4 ${
                            device.status === "connected"
                              ? "text-green-500"
                              : "text-gray-400"
                          }`}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => disconnectDevice(device.deviceId)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="연결 해제"
                        >
                          <X className="h-4 w-4" />
                        </Button>
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
