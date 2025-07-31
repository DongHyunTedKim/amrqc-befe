"use client";

import { useEffect, useRef, useCallback } from "react";
import { useDashboardStore } from "../stores/dashboardStore";

interface PollingOptions {
  serverStatusInterval?: number; // 서버 상태 폴링 간격 (ms)
  dataSummaryInterval?: number; // 데이터 요약 폴링 간격 (ms)
  devicesInterval?: number; // 디바이스 목록 폴링 간격 (ms)
  enabled?: boolean; // 폴링 활성화 여부
}

const DEFAULT_OPTIONS: Required<PollingOptions> = {
  serverStatusInterval: 5000, // 5초
  dataSummaryInterval: 10000, // 10초
  devicesInterval: 2000, // 2초
  enabled: true,
};

/**
 * 대시보드 데이터를 주기적으로 폴링하는 커스텀 훅
 */
export function useDashboardPolling(options: PollingOptions = {}) {
  const {
    fetchServerStatus,
    fetchDataSummary,
    fetchConnectedDevices,
    fetchServerInfo,
  } = useDashboardStore();

  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 타이머 레퍼런스
  const serverStatusTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dataSummaryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const devicesTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 폴링 중지 함수
  const stopPolling = useCallback(() => {
    if (serverStatusTimerRef.current) {
      clearInterval(serverStatusTimerRef.current);
      serverStatusTimerRef.current = null;
    }
    if (dataSummaryTimerRef.current) {
      clearInterval(dataSummaryTimerRef.current);
      dataSummaryTimerRef.current = null;
    }
    if (devicesTimerRef.current) {
      clearInterval(devicesTimerRef.current);
      devicesTimerRef.current = null;
    }
  }, []);

  // 폴링 시작 함수
  const startPolling = useCallback(() => {
    if (!opts.enabled) return;

    // 즉시 한 번 실행
    fetchServerStatus();
    fetchDataSummary();
    fetchConnectedDevices();

    // 서버 상태 폴링
    serverStatusTimerRef.current = setInterval(() => {
      fetchServerStatus();
    }, opts.serverStatusInterval);

    // 데이터 요약 폴링
    dataSummaryTimerRef.current = setInterval(() => {
      fetchDataSummary();
    }, opts.dataSummaryInterval);

    // 디바이스 목록 폴링
    devicesTimerRef.current = setInterval(() => {
      fetchConnectedDevices();
    }, opts.devicesInterval);
  }, [
    opts.enabled,
    opts.serverStatusInterval,
    opts.dataSummaryInterval,
    opts.devicesInterval,
    // fetch 함수들 제거 (Zustand store 함수들은 안정적)
  ]);

  // 초기 서버 정보 fetch (한 번만)
  useEffect(() => {
    fetchServerInfo();
  }, []); // 한 번만 실행

  // 폴링 관리
  useEffect(() => {
    if (opts.enabled) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [opts.enabled]); // startPolling, stopPolling 제거

  // Visibility change 처리 (탭이 백그라운드로 갈 때 폴링 중지)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else if (opts.enabled) {
        startPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [opts.enabled]); // startPolling, stopPolling 제거

  return {
    startPolling,
    stopPolling,
    refetch: {
      serverStatus: fetchServerStatus,
      dataSummary: fetchDataSummary,
      connectedDevices: fetchConnectedDevices,
      serverInfo: fetchServerInfo,
    },
  };
}
