"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// 센서 데이터 타입 (기존 타입 재사용)
interface SensorData {
  id: number;
  deviceId: string;
  timestamp: number;
  sensorType: string;
  value: any;
  createdAt: string;
}

interface WebSocketMessage {
  type: string;
  data?: any;
  errorCode?: string;
  errorMessage?: string;
  timestamp?: number;
}

interface WebSocketOptions {
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onNewSensorData?: (data: SensorData) => void;
  onConnectionChange?: (connected: boolean) => void;
}

interface WebSocketState {
  connected: boolean;
  reconnecting: boolean;
  error: string | null;
  attemptCount: number;
}

const DEFAULT_OPTIONS: Required<
  Omit<WebSocketOptions, "onNewSensorData" | "onConnectionChange">
> = {
  autoConnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
};

/**
 * 타임라인 페이지용 WebSocket 연결을 관리하는 커스텀 훅
 */
export function useTimelineWebSocket(options: WebSocketOptions = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  const [state, setState] = useState<WebSocketState>({
    connected: false,
    reconnecting: false,
    error: null,
    attemptCount: 0,
  });

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
            console.log("Timeline WebSocket 연결 성공:", message.data);
            break;

          case "sensor_data":
            // 새로운 센서 데이터 수신
            if (message.data && options.onNewSensorData) {
              // 서버에서 받은 데이터를 클라이언트 형식으로 변환
              const sensorData: SensorData = {
                id: message.data.id || Date.now(), // 임시 ID
                deviceId: message.data.deviceId,
                timestamp: message.data.timestamp,
                sensorType: message.data.sensorType,
                value: message.data.value,
                createdAt: new Date(message.data.timestamp).toISOString(),
              };
              options.onNewSensorData(sensorData);
            }
            break;

          case "device_connected":
            console.log("Device connected:", message.data?.deviceId);
            break;

          case "device_disconnected":
            console.log("Device disconnected:", message.data?.deviceId);
            break;

          case "error":
            console.error("WebSocket 오류:", message.errorMessage);
            setState((prev) => ({
              ...prev,
              error: message.errorMessage || "Unknown error",
            }));
            break;

          default:
            console.log("Unknown message type:", message.type);
        }
      } catch (error) {
        console.error("메시지 파싱 오류:", error);
      }
    },
    [options.onNewSensorData]
  );

  // 연결 해제
  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      connected: false,
      reconnecting: false,
    }));
    reconnectAttemptsRef.current = 0;
  }, []);

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
        console.log("Timeline WebSocket 연결됨");
        setState((prev) => ({
          ...prev,
          connected: true,
          reconnecting: false,
          error: null,
          attemptCount: reconnectAttemptsRef.current,
        }));
        reconnectAttemptsRef.current = 0;

        if (options.onConnectionChange) {
          options.onConnectionChange(true);
        }
      };

      ws.onmessage = handleMessage;

      ws.onerror = (error) => {
        console.error("Timeline WebSocket 오류:", error);
        setState((prev) => ({
          ...prev,
          error: "Connection error",
        }));
      };

      ws.onclose = (event) => {
        console.log("Timeline WebSocket 연결 종료:", event.code, event.reason);
        setState((prev) => ({
          ...prev,
          connected: false,
        }));

        if (options.onConnectionChange) {
          options.onConnectionChange(false);
        }

        // 자동 재연결
        if (
          opts.autoConnect &&
          reconnectAttemptsRef.current < opts.maxReconnectAttempts
        ) {
          setState((prev) => ({
            ...prev,
            reconnecting: true,
            attemptCount: reconnectAttemptsRef.current + 1,
          }));
          reconnectAttemptsRef.current++;

          console.log(
            `Timeline 재연결 시도 ${reconnectAttemptsRef.current}/${opts.maxReconnectAttempts}`
          );

          reconnectTimerRef.current = setTimeout(() => {
            connect();
          }, opts.reconnectInterval);
        } else if (reconnectAttemptsRef.current >= opts.maxReconnectAttempts) {
          setState((prev) => ({
            ...prev,
            error: "재연결 시도 횟수 초과",
            reconnecting: false,
          }));
        }
      };
    } catch (error) {
      console.error("Timeline WebSocket 연결 실패:", error);
      setState((prev) => ({
        ...prev,
        connected: false,
        error: error instanceof Error ? error.message : "Connection failed",
      }));
    }
  }, [wsUrl, disconnect, handleMessage, opts, options.onConnectionChange]);

  // 메시지 전송
  const sendMessage = useCallback((message: Partial<WebSocketMessage>) => {
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

  // 수동 재연결
  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setState((prev) => ({
      ...prev,
      error: null,
      reconnecting: false,
      attemptCount: 0,
    }));
    connect();
  }, [connect]);

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
      if (!document.hidden) {
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
    ...state,
    connect,
    disconnect,
    reconnect,
    sendMessage,
    ws: wsRef.current,
  };
}
