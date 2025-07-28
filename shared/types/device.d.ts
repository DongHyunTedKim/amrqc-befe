/**
 * 디바이스 관련 타입 정의
 */

import { ApiResponse } from "./base";

/**
 * 디바이스 상태
 */
export type DeviceStatus = "active" | "inactive" | "maintenance" | "error";

/**
 * 디바이스 기본 정보
 */
export interface Device {
  deviceId: string;
  name?: string;
  description?: string;
  status: DeviceStatus;
  lastSeenAt?: number;
  registeredAt: number;
  metadata?: {
    model?: string;
    firmware?: string;
    location?: string;
    [key: string]: any;
  };
}

/**
 * 디바이스 등록 요청
 */
export interface DeviceRegistrationRequest {
  deviceId: string;
  name?: string;
  description?: string;
  metadata?: Device["metadata"];
}

/**
 * 디바이스 업데이트 요청
 */
export interface DeviceUpdateRequest {
  name?: string;
  description?: string;
  status?: DeviceStatus;
  metadata?: Device["metadata"];
}

/**
 * 디바이스 통계
 */
export interface DeviceStats {
  deviceId: string;
  totalDataPoints: number;
  lastDataReceived?: number;
  sensorTypes: string[];
  dataByHour: {
    hour: string;
    count: number;
  }[];
}

/**
 * 디바이스 목록 응답
 */
export interface DeviceListResponse extends ApiResponse<Device[]> {
  total: number;
  activeCount: number;
  inactiveCount: number;
}

/**
 * 디바이스 상세 응답
 */
export interface DeviceDetailResponse extends ApiResponse<Device> {
  stats?: DeviceStats;
}
