import { useState, useEffect } from "react";

interface NetworkInfo {
  primaryIP: string;
  allIPs: string[];
  hostname: string;
}

interface ServerUrls {
  websocket: string;
  http: string;
  allWebsocketUrls: string[];
}

interface ServerInfo {
  network: NetworkInfo;
  urls: ServerUrls;
  ports: {
    websocket: number;
    http: number;
  };
}

interface ServerStatus {
  status: "running" | "stopped";
  startTime: number;
  uptime: number;
  websocket: {
    connected: boolean;
    connections: number;
    messagesReceived?: number;
  };
  queue?: {
    size: number;
    lossRate: string;
    batchCount: number;
  };
}

export function useServerInfo() {
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchServerInfo();
    fetchServerStatus();

    // 5초마다 서버 상태 업데이트
    const interval = setInterval(() => {
      fetchServerStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const fetchServerInfo = async () => {
    try {
      // 개발 환경에서는 localhost 사용
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/api/server/info`);

      if (!response.ok) {
        throw new Error("Failed to fetch server info");
      }

      const data = await response.json();
      if (data.success) {
        setServerInfo(data.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      console.error("Error fetching server info:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchServerStatus = async () => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/api/server/status`);

      if (!response.ok) {
        throw new Error("Failed to fetch server status");
      }

      const data = await response.json();
      if (data.success) {
        setServerStatus(data.data);
      }
    } catch (err) {
      console.error("Error fetching server status:", err);
      // 상태 조회 실패 시 기본값 설정
      setServerStatus({
        status: "stopped",
        startTime: Date.now(),
        uptime: 0,
        websocket: {
          connected: false,
          connections: 0,
        },
      });
    }
  };

  return {
    serverInfo,
    serverStatus,
    loading,
    error,
    refetch: () => {
      fetchServerInfo();
      fetchServerStatus();
    },
  };
}
