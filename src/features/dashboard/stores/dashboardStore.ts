"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";

// 서버 정보 타입
interface ServerInfo {
  network: {
    primaryIP: string;
    allIPs: string[];
  };
  urls: {
    websocket: string;
    http: string;
  };
  ports: {
    websocket: number;
    http: number;
  };
}

// 서버 상태 타입
interface ServerStatus {
  status: string;
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

// 데이터 요약 타입
interface DataSummary {
  total: {
    totalRecords: number;
    totalDevices: number;
    totalSensorTypes: number;
    minTime: number;
    maxTime: number;
  };
  byDevice: Record<
    string,
    {
      totalRecords: number;
      sensors: Record<
        string,
        {
          count: number;
          days: number;
          timeRange: {
            start: number;
            end: number;
          };
        }
      >;
      timeRange: {
        start: number;
        end: number;
      };
    }
  >;
}

// 연결된 디바이스 타입
interface ConnectedDevice {
  deviceId: string;
  connectedAt: number;
  lastSeen: number;
  messageCount: number;
  status: "connected" | "disconnected";
}

// 대시보드 상태 타입
interface DashboardState {
  // 서버 정보
  serverInfo: ServerInfo | null;
  serverStatus: ServerStatus | null;

  // 데이터 통계
  dataSummary: DataSummary | null;

  // 연결된 디바이스
  connectedDevices: ConnectedDevice[];

  // 로딩 상태
  loading: {
    serverInfo: boolean;
    serverStatus: boolean;
    dataSummary: boolean;
    devices: boolean;
  };

  // 에러 상태
  errors: {
    serverInfo: string | null;
    serverStatus: string | null;
    dataSummary: string | null;
    devices: string | null;
  };

  // WebSocket 상태
  wsConnected: boolean;
  wsReconnecting: boolean;

  // 실시간 통계
  realtimeStats: {
    packetsPerSecond: number;
    lastUpdateTime: number;
  };
}

// 대시보드 액션 타입
interface DashboardActions {
  // 서버 정보 업데이트
  setServerInfo: (info: ServerInfo | null) => void;
  setServerStatus: (status: ServerStatus | null) => void;

  // 데이터 통계 업데이트
  setDataSummary: (summary: DataSummary | null) => void;

  // 연결된 디바이스 업데이트
  setConnectedDevices: (devices: ConnectedDevice[]) => void;
  updateDeviceStatus: (
    deviceId: string,
    status: "connected" | "disconnected"
  ) => void;

  // 로딩 상태 업데이트
  setLoading: (key: keyof DashboardState["loading"], value: boolean) => void;

  // 에러 상태 업데이트
  setError: (key: keyof DashboardState["errors"], error: string | null) => void;

  // WebSocket 상태 업데이트
  setWsConnected: (connected: boolean) => void;
  setWsReconnecting: (reconnecting: boolean) => void;

  // 실시간 통계 업데이트
  updateRealtimeStats: (packetsPerSecond: number) => void;

  // 서버 데이터 fetch
  fetchServerInfo: () => Promise<void>;
  fetchServerStatus: () => Promise<void>;
  fetchDataSummary: () => Promise<void>;
  fetchConnectedDevices: () => Promise<void>;

  // 리셋
  reset: () => void;
}

// 초기 상태
const initialState: DashboardState = {
  serverInfo: null,
  serverStatus: null,
  dataSummary: null,
  connectedDevices: [],
  loading: {
    serverInfo: false,
    serverStatus: false,
    dataSummary: false,
    devices: false,
  },
  errors: {
    serverInfo: null,
    serverStatus: null,
    dataSummary: null,
    devices: null,
  },
  wsConnected: false,
  wsReconnecting: false,
  realtimeStats: {
    packetsPerSecond: 0,
    lastUpdateTime: Date.now(),
  },
};

// API 기본 URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Zustand store 생성
export const useDashboardStore = create<DashboardState & DashboardActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // 서버 정보 업데이트
      setServerInfo: (info) => set({ serverInfo: info }),
      setServerStatus: (status) => set({ serverStatus: status }),

      // 데이터 통계 업데이트
      setDataSummary: (summary) => set({ dataSummary: summary }),

      // 연결된 디바이스 업데이트
      setConnectedDevices: (devices) => set({ connectedDevices: devices }),
      updateDeviceStatus: (deviceId, status) =>
        set((state) => ({
          connectedDevices: state.connectedDevices.map((device) =>
            device.deviceId === deviceId ? { ...device, status } : device
          ),
        })),

      // 로딩 상태 업데이트
      setLoading: (key, value) =>
        set((state) => ({
          loading: { ...state.loading, [key]: value },
        })),

      // 에러 상태 업데이트
      setError: (key, error) =>
        set((state) => ({
          errors: { ...state.errors, [key]: error },
        })),

      // WebSocket 상태 업데이트
      setWsConnected: (connected) => set({ wsConnected: connected }),
      setWsReconnecting: (reconnecting) =>
        set({ wsReconnecting: reconnecting }),

      // 실시간 통계 업데이트
      updateRealtimeStats: (packetsPerSecond) =>
        set({
          realtimeStats: {
            packetsPerSecond,
            lastUpdateTime: Date.now(),
          },
        }),

      // 서버 정보 fetch
      fetchServerInfo: async () => {
        const { setLoading, setError, setServerInfo } = get();
        setLoading("serverInfo", true);
        setError("serverInfo", null);

        try {
          const response = await fetch(`${API_BASE}/api/server/info`);
          if (!response.ok) {
            throw new Error(`서버 정보 조회 실패: ${response.status}`);
          }

          const data = await response.json();
          if (data.success) {
            setServerInfo(data.data);
          } else {
            throw new Error(data.error || "서버 정보 조회 실패");
          }
        } catch (error) {
          setError(
            "serverInfo",
            error instanceof Error ? error.message : "알 수 없는 오류"
          );
          console.error("서버 정보 조회 오류:", error);
        } finally {
          setLoading("serverInfo", false);
        }
      },

      // 서버 상태 fetch
      fetchServerStatus: async () => {
        const { setLoading, setError, setServerStatus } = get();
        setLoading("serverStatus", true);
        setError("serverStatus", null);

        try {
          const response = await fetch(`${API_BASE}/api/server/status`);
          if (!response.ok) {
            throw new Error(`서버 상태 조회 실패: ${response.status}`);
          }

          const data = await response.json();
          if (data.success) {
            setServerStatus(data.data);
          } else {
            throw new Error(data.error || "서버 상태 조회 실패");
          }
        } catch (error) {
          setError(
            "serverStatus",
            error instanceof Error ? error.message : "알 수 없는 오류"
          );
          console.error("서버 상태 조회 오류:", error);
        } finally {
          setLoading("serverStatus", false);
        }
      },

      // 데이터 요약 fetch
      fetchDataSummary: async () => {
        const { setLoading, setError, setDataSummary } = get();
        setLoading("dataSummary", true);
        setError("dataSummary", null);

        try {
          const response = await fetch(`${API_BASE}/api/data/summary`);
          if (!response.ok) {
            throw new Error(`데이터 요약 조회 실패: ${response.status}`);
          }

          const data = await response.json();
          if (data.success) {
            setDataSummary(data.data);
          } else {
            throw new Error(data.error || "데이터 요약 조회 실패");
          }
        } catch (error) {
          setError(
            "dataSummary",
            error instanceof Error ? error.message : "알 수 없는 오류"
          );
          console.error("데이터 요약 조회 오류:", error);
        } finally {
          setLoading("dataSummary", false);
        }
      },

      // 연결된 디바이스 fetch
      fetchConnectedDevices: async () => {
        const { setLoading, setError, setConnectedDevices } = get();
        setLoading("devices", true);
        setError("devices", null);

        try {
          const response = await fetch(`${API_BASE}/api/server/devices`);
          if (!response.ok) {
            throw new Error(`디바이스 목록 조회 실패: ${response.status}`);
          }

          const data = await response.json();
          if (data.success) {
            setConnectedDevices(data.data.devices);
          } else {
            throw new Error(data.error || "디바이스 목록 조회 실패");
          }
        } catch (error) {
          setError(
            "devices",
            error instanceof Error ? error.message : "알 수 없는 오류"
          );
          console.error("디바이스 목록 조회 오류:", error);
        } finally {
          setLoading("devices", false);
        }
      },

      // 리셋
      reset: () => set(initialState),
    }),
    {
      name: "dashboard-store",
    }
  )
);

// Selector hooks
export const useServerInfo = () =>
  useDashboardStore((state) => state.serverInfo);
export const useServerStatus = () =>
  useDashboardStore((state) => state.serverStatus);
export const useDataSummary = () =>
  useDashboardStore((state) => state.dataSummary);
export const useConnectedDevices = () =>
  useDashboardStore((state) => state.connectedDevices);
export const useWebSocketStatus = () =>
  useDashboardStore((state) => ({
    connected: state.wsConnected,
    reconnecting: state.wsReconnecting,
  }));
export const useRealtimeStats = () =>
  useDashboardStore((state) => state.realtimeStats);
