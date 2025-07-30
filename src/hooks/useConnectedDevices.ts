import { useState, useEffect } from "react";

interface ConnectedDevice {
  id: string;
  deviceId: string;
  connectedAt: number;
  messageCount: number;
  lastActivity: number;
  status: "connected" | "disconnected";
}

export function useConnectedDevices() {
  const [devices, setDevices] = useState<ConnectedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDevices();

    // 2초마다 디바이스 목록 업데이트
    const interval = setInterval(() => {
      fetchDevices();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const fetchDevices = async () => {
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${baseUrl}/api/server/devices`);

      if (!response.ok) {
        throw new Error("Failed to fetch connected devices");
      }

      const data = await response.json();
      if (data.success) {
        setDevices(data.data.devices);
        setError(null);
      }
    } catch (err) {
      console.error("Error fetching connected devices:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return {
    devices,
    loading,
    error,
    refetch: fetchDevices,
  };
}
