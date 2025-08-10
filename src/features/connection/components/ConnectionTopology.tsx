"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Laptop,
  Server,
  Smartphone,
  Wifi,
  WifiOff,
  Play,
  Square,
} from "lucide-react";

type DeviceNode = {
  id: string;
  deviceId: string;
  status: "connected" | "disconnected";
  connectedAt?: number;
  messageCount?: number;
  sessionId?: string | null;
  hasActiveSession?: boolean;
};

interface ConnectionTopologyProps {
  serverOnline: boolean;
  viewerOnline: boolean;
  devices: DeviceNode[];
}

export function ConnectionTopology({
  serverOnline,
  viewerOnline,
  devices,
}: ConnectionTopologyProps) {
  const connectedDevices = devices.filter((d) => d.status === "connected");

  const connectionData = useMemo(() => {
    // 서버 상태
    const serverStatus = {
      name: "AMR QC 서버",
      type: "server" as const,
      status: serverOnline ? "online" : "offline",
      statusText: serverOnline ? "온라인" : "오프라인",
      icon: Server,
      color: serverOnline ? "text-green-600" : "text-red-600",
      bgColor: serverOnline ? "bg-green-50" : "bg-red-50",
      details: undefined as string | undefined,
      messageCount: undefined as number | undefined,
      messageRate: undefined as number | undefined,
    };

    // 모니터링 웹뷰어 상태
    const viewerStatus = {
      name: "모니터링 웹뷰어",
      type: "viewer" as const,
      status: viewerOnline ? "connected" : "disconnected",
      statusText: viewerOnline ? "연결됨" : "연결 끊김",
      icon: Laptop,
      color: viewerOnline ? "text-blue-600" : "text-gray-400",
      bgColor: viewerOnline ? "bg-blue-50" : "bg-gray-50",
      details: "현재 사용자",
      messageCount: undefined as number | undefined,
      messageRate: undefined as number | undefined,
    };

    // 디바이스 상태 목록
    const deviceStatuses = devices.map((device) => {
      const isConnected = device.status === "connected";
      const messageRate =
        device.messageCount && device.connectedAt
          ? Math.round(
              device.messageCount / ((Date.now() - device.connectedAt) / 1000)
            )
          : 0;

      return {
        name: device.deviceId,
        type: "device" as const,
        status: device.status,
        statusText: isConnected ? "연결됨" : "연결 끊김",
        icon: Smartphone,
        color: isConnected ? "text-green-600" : "text-gray-400",
        bgColor: isConnected ? "bg-green-50" : "bg-gray-50",
        details: isConnected
          ? `${(device.messageCount || 0).toLocaleString()} 메시지${
              messageRate > 0 ? ` (${messageRate}/초)` : ""
            }${device.hasActiveSession ? " • 세션 활성" : " • 대기 중"}`
          : "대기 중",
        messageCount: device.messageCount || 0,
        messageRate,
      };
    });

    return { serverStatus, viewerStatus, deviceStatuses };
  }, [devices, serverOnline, viewerOnline]);

  const { serverStatus, viewerStatus, deviceStatuses } = connectionData;
  const allConnections = [serverStatus, viewerStatus, ...deviceStatuses];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>연결 현황</span>
          <Badge variant={connectedDevices.length > 0 ? "default" : "outline"}>
            스마트폰: {connectedDevices.length}대 연결됨
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allConnections.map((connection, index) => {
            const IconComponent = connection.icon;
            const isConnected =
              connection.status === "online" ||
              connection.status === "connected";

            return (
              <div
                key={`${connection.type}-${index}`}
                className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                  isConnected
                    ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                    : "border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${connection.bgColor}`}
                  >
                    <IconComponent className={`h-5 w-5 ${connection.color}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">
                        {connection.name}
                      </p>
                      {isConnected ? (
                        <Wifi className="h-4 w-4 text-green-600" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <p className={`text-sm ${connection.color}`}>
                      {connection.statusText}
                      {connection.details && (
                        <span className="ml-2 text-muted-foreground">
                          • {connection.details}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {connection.type === "device" && isConnected && (
                  <div className="flex items-center gap-3 text-right">
                    <div className="text-xs text-muted-foreground">
                      <div>
                        {connection.messageCount.toLocaleString()} 메시지
                      </div>
                      {connection.messageRate > 0 && (
                        <div className="text-green-600">
                          {connection.messageRate}/초
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {devices.find((d) => d.deviceId === connection.name)
                        ?.hasActiveSession ? (
                        <Play className="h-3 w-3 text-green-600" />
                      ) : (
                        <Square className="h-3 w-3 text-gray-500" />
                      )}
                      <Activity className="h-4 w-4 text-green-600 animate-pulse" />
                    </div>
                  </div>
                )}

                {connection.type === "server" && isConnected && (
                  <div className="flex items-center">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  </div>
                )}

                {connection.type === "viewer" && isConnected && (
                  <div className="flex items-center">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {deviceStatuses.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="text-center">
              <Smartphone className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">연결된 스마트폰이 없습니다</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ConnectionTopology;
