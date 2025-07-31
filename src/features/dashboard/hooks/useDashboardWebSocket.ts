"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useDashboardStore } from "../stores/dashboardStore";

interface WebSocketOptions {
  autoConnect?: boolean; // 자동 연결 여부
  reconnectInterval?: number; // 재연결 시도 간격 (ms)
  maxReconnectAttempts?: number; // 최대 재연결 시도 횟수
  onMessage?: (data: any) => void; // 메시지 수신 콜백
  onConnectionChange?: (connected: boolean) => void; // 연결 상태 변경 콜백
}

const DEFAULT_OPTIONS: Required<
  Omit<WebSocketOptions, "onMessage" | "onConnectionChange">
> = {
  autoConnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
};

interface WebSocketMessage {
  type: string;
  data?: any;
  error?: string;
  errorCode?: string;
  errorMessage?: string;
  timestamp?: number;
}

/**
 * 대시보드 WebSocket 연결을 관리하는 커스텀 훅
 */
export function useDashboardWebSocket(options: WebSocketOptions = {}) {
  const {
    setWsConnected,
    setWsReconnecting,
    updateRealtimeStats,
    setServerStatus,
    updateDeviceStatus,
    setConnectedDevices,
    setError,
  } = useDashboardStore();

  const opts = { ...DEFAULT_OPTIONS, ...options };

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  // WebSocket URL 가져오기
  useEffect(() => {
    const fetchWsUrl = async () => {
      try {
        const response = await fetch(
          `${
            process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
          }/api/server/info`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setWsUrl(data.data.urls.websocket);
          }
        }
      } catch (error) {
        console.error("WebSocket URL 조회 실패:", error);
        // 기본값 사용
        setWsUrl("ws://localhost:8001");
      }
    };

    fetchWsUrl();
  }, []);

  // 메시지 처리
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        switch (message.type) {
          case "welcome":
            console.log("WebSocket 연결 성공:", message.data);
            break;

          case "stats":
            // 서버 통계 업데이트
            if (message.data?.server) {
              setServerStatus({
                status: "running",
                startTime: message.data.server.startTime,
                uptime: message.data.server.uptime,
                websocket: {
                  connected: true,
                  connections: message.data.server.connections || 0,
                  messagesReceived: message.data.server.messagesReceived || 0,
                },
                queue: message.data.server.queue,
              });
            }

            // 실시간 통계 업데이트
            if (message.data?.realtime) {
              updateRealtimeStats(message.data.realtime.packetsPerSecond || 0);
            }
            break;

          case "device_connected":
            // 디바이스 연결
            if (message.data?.deviceId) {
              updateDeviceStatus(message.data.deviceId, "connected");
            }
            break;

          case "device_disconnected":
            // 디바이스 연결 해제
            if (message.data?.deviceId) {
              updateDeviceStatus(message.data.deviceId, "disconnected");
            }
            break;

          case "devices_update":
            // 전체 디바이스 목록 업데이트
            if (message.data?.devices) {
              setConnectedDevices(message.data.devices);
            }
            break;

          case "error":
            const errorMessage =
              message.errorMessage ||
              message.error ||
              message.data ||
              "알 수 없는 에러";
            const errorCode = message.errorCode
              ? `[${message.errorCode}] `
              : "";
            const fullErrorMessage = `${errorCode}${errorMessage}`;

            console.error("WebSocket 에러:", fullErrorMessage);
            setError("serverStatus", fullErrorMessage);
            break;

          default:
            // 사용자 정의 메시지 처리
            if (opts.onMessage) {
              opts.onMessage(message);
            }
        }
      } catch (error) {
        console.error("메시지 파싱 오류:", error);
      }
    },
    [
      setServerStatus,
      updateRealtimeStats,
      updateDeviceStatus,
      setConnectedDevices,
      setError,
      opts,
    ]
  );

  // WebSocket 연결 해제
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setWsConnected(false);
    setWsReconnecting(false);
    reconnectAttemptsRef.current = 0;
  }, [setWsConnected, setWsReconnecting]);

  // WebSocket 연결
  const connect = useCallback(() => {
    if (!wsUrl || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    disconnect();

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket 연결됨");
        setWsConnected(true);
        setWsReconnecting(false);
        reconnectAttemptsRef.current = 0;

        // 대시보드 클라이언트는 별도 등록 불필요
        // 서버에서 welcome 메시지를 자동으로 보내줌

        if (opts.onConnectionChange) {
          opts.onConnectionChange(true);
        }
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error("WebSocket 오류:", error);
      };

      ws.onclose = (event) => {
        console.log("WebSocket 연결 종료:", event.code, event.reason);
        setWsConnected(false);

        if (opts.onConnectionChange) {
          opts.onConnectionChange(false);
        }

        // 자동 재연결
        if (
          opts.autoConnect &&
          reconnectAttemptsRef.current < opts.maxReconnectAttempts
        ) {
          setWsReconnecting(true);
          reconnectAttemptsRef.current++;

          console.log(
            `재연결 시도 ${reconnectAttemptsRef.current}/${opts.maxReconnectAttempts}`
          );

          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, opts.reconnectInterval);
        }
      };
    } catch (error) {
      console.error("WebSocket 연결 실패:", error);
      setWsConnected(false);
    }
  }, [
    wsUrl,
    disconnect,
    handleMessage,
    setWsConnected,
    setWsReconnecting,
    opts,
  ]);

  // 메시지 전송
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          ...message,
          timestamp: message.timestamp || Date.now(),
        })
      );
      return true;
    }
    return false;
  }, []);

  // 자동 연결
  useEffect(() => {
    if (opts.autoConnect && wsUrl) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [opts.autoConnect, wsUrl]); // connect, disconnect 제거

  // Visibility change 처리
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // 백그라운드로 갈 때는 연결 유지 (필요시 끊을 수도 있음)
      } else {
        // 포그라운드로 돌아올 때 연결 상태 확인
        if (opts.autoConnect && wsRef.current?.readyState !== WebSocket.OPEN) {
          connect();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [opts.autoConnect]); // connect 제거

  return {
    connected: wsRef.current?.readyState === WebSocket.OPEN,
    connect,
    disconnect,
    sendMessage,
    ws: wsRef.current,
  };
}
