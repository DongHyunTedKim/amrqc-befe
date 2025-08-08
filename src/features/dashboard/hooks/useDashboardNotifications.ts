"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useDashboardStore } from "../stores/dashboardStore";

interface NotificationOptions {
  enabled?: boolean;
  showDeviceConnections?: boolean;
  showErrors?: boolean;
  showStats?: boolean;
}

const DEFAULT_OPTIONS: Required<NotificationOptions> = {
  enabled: true,
  showDeviceConnections: true,
  showErrors: true,
  showStats: false,
};

/**
 * 대시보드 알림을 관리하는 커스텀 훅
 */
export function useDashboardNotifications(options: NotificationOptions = {}) {
  const { toast } = useToast();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const { connectedDevices, errors, serverStatus, wsConnected } =
    useDashboardStore();

  // 이전 상태 추적
  const prevDevicesRef = useRef(connectedDevices);
  const prevErrorsRef = useRef(errors);
  const prevWsConnectedRef = useRef(wsConnected);

  // 디바이스 연결 알림
  useEffect(() => {
    if (!opts.enabled || !opts.showDeviceConnections) return;

    const prevDevices = prevDevicesRef.current;
    const currentDevices = connectedDevices;

    // 새로 연결된 디바이스 찾기
    const newDevices = currentDevices.filter(
      (device) => !prevDevices.find((prev) => prev.deviceId === device.deviceId)
    );

    // 연결 해제된 디바이스 찾기
    const disconnectedDevices = prevDevices.filter((device) => {
      const current = currentDevices.find(
        (curr) => curr.deviceId === device.deviceId
      );
      return !current || current.status === "disconnected";
    });

    // 알림 표시 (unregistered-* 필터링)
    newDevices
      .filter((d) => !d.deviceId?.startsWith("unregistered-"))
      .forEach((device) => {
        toast({
          title: "디바이스 연결됨",
          description: `${device.deviceId}가 연결되었습니다.`,
        });
      });

    disconnectedDevices
      .filter((d) => !d.deviceId?.startsWith("unregistered-"))
      .forEach((device) => {
        toast({
          title: "디바이스 연결 해제",
          description: `${device.deviceId}의 연결이 해제되었습니다.`,
          variant: "destructive",
        });
      });

    prevDevicesRef.current = currentDevices;
  }, [connectedDevices, opts.enabled, opts.showDeviceConnections, toast]);

  // 에러 알림
  useEffect(() => {
    if (!opts.enabled || !opts.showErrors) return;

    const prevErrors = prevErrorsRef.current;
    const currentErrors = errors;

    // 새로운 에러 확인
    Object.entries(currentErrors).forEach(([key, error]) => {
      if (error && error !== prevErrors[key as keyof typeof prevErrors]) {
        toast({
          title: "오류 발생",
          description: error,
          variant: "destructive",
        });
      }
    });

    prevErrorsRef.current = currentErrors;
  }, [errors, opts.enabled, opts.showErrors, toast]);

  // WebSocket 연결 상태 알림
  useEffect(() => {
    if (!opts.enabled) return;

    const prevConnected = prevWsConnectedRef.current;
    const currentConnected = wsConnected;

    if (!prevConnected && currentConnected) {
      toast({
        title: "실시간 연결 성공",
        description: "서버와 실시간 연결이 수립되었습니다.",
      });
    } else if (prevConnected && !currentConnected) {
      toast({
        title: "실시간 연결 끊김",
        description: "서버와의 연결이 끊어졌습니다. 재연결을 시도합니다.",
        variant: "destructive",
      });
    }

    prevWsConnectedRef.current = currentConnected;
  }, [wsConnected, opts.enabled, toast]);

  // 서버 통계 알림 (선택적)
  useEffect(() => {
    if (!opts.enabled || !opts.showStats) return;

    if (serverStatus?.queue && parseFloat(serverStatus.queue.lossRate) > 1) {
      toast({
        title: "데이터 손실 경고",
        description: `현재 패킷 손실률이 ${serverStatus.queue.lossRate}%입니다.`,
        variant: "destructive",
      });
    }
  }, [serverStatus, opts.enabled, opts.showStats, toast]);
}
