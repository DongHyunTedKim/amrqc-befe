"use client";

import { create } from "zustand";

export interface SensorData {
  id: number;
  deviceId: string;
  sessionId?: string | null;
  timestamp: number;
  sensorType: string;
  value: any;
  createdAt?: string;
}

type SensorTypeMap = Record<string, SensorData[]>; // sensorType -> data
type SessionDataMap = Record<string, SensorTypeMap>; // sessionId -> sensors

interface MonitoringState {
  dataBySession: SessionDataMap;
  replaceHistory: (
    sessionId: string,
    sensorType: string,
    data: SensorData[]
  ) => void;
  appendLive: (sessionId: string, data: SensorData) => void;
  getData: (sessionId: string, sensorType?: string) => SensorData[];
}

const MAX_ITEMS_PER_SENSOR = 5000;

function mergeUnique(
  existing: SensorData[],
  incoming: SensorData[]
): SensorData[] {
  const seen = new Set<string>();
  const combined = [...incoming, ...existing];
  const deduped: SensorData[] = [];
  for (const item of combined) {
    const key = `${item.sensorType}-${item.timestamp}-${item.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }
  // 최신순으로 정렬 후 최대 개수 제한
  deduped.sort((a, b) => b.timestamp - a.timestamp);
  return deduped.slice(0, MAX_ITEMS_PER_SENSOR);
}

export const useMonitoringStore = create<MonitoringState>((set, get) => ({
  dataBySession: {},

  replaceHistory: (sessionId, sensorType, data) => {
    set((state) => {
      const prevSession = state.dataBySession[sessionId] || {};
      const nextSensorData = mergeUnique(prevSession[sensorType] || [], data);
      return {
        dataBySession: {
          ...state.dataBySession,
          [sessionId]: { ...prevSession, [sensorType]: nextSensorData },
        },
      };
    });
  },

  appendLive: (sessionId, data) => {
    set((state) => {
      const prevSession = state.dataBySession[sessionId] || {};
      const list = prevSession[data.sensorType] || [];
      const nextList = mergeUnique(list, [data]);
      return {
        dataBySession: {
          ...state.dataBySession,
          [sessionId]: { ...prevSession, [data.sensorType]: nextList },
        },
      };
    });
  },

  getData: (sessionId, sensorType) => {
    const sessionMap = get().dataBySession[sessionId];
    if (!sessionMap) return [];
    if (sensorType) return sessionMap[sensorType] || [];
    // 모든 센서 데이터 합치기
    const all: SensorData[] = Object.values(sessionMap).flat();
    return all.sort((a, b) => b.timestamp - a.timestamp);
  },
}));
