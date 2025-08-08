/**
 * 세션 관련 타입 정의
 */

import { ApiResponse } from "./base";

/**
 * 세션 상태
 */
export type SessionStatus = "active" | "completed" | "error" | "paused";

/**
 * 세션 정보
 */
export interface Session {
  sessionId: string;
  deviceId: string;
  startTime: number; // Unix timestamp (ms)
  endTime?: number; // Unix timestamp (ms), null if active
  status: SessionStatus;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  // 통계 정보 (API 응답에서 추가)
  dataCount?: number;
  firstDataTime?: number;
  lastDataTime?: number;
}

/**
 * 세션 생성 요청
 */
export interface CreateSessionRequest {
  deviceId: string;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * 세션 생성 응답
 */
export interface CreateSessionResponse extends ApiResponse {
  data?: {
    sessionId: string;
    deviceId: string;
    startTime: number;
    status: SessionStatus;
    description?: string;
    metadata?: Record<string, any>;
  };
}

/**
 * 세션 목록 조회 요청
 */
export interface GetSessionsRequest {
  deviceId?: string;
  status?: SessionStatus;
  limit?: number;
  offset?: number;
}

/**
 * 세션 목록 조회 응답
 */
export interface GetSessionsResponse extends ApiResponse {
  data?: Session[];
  pagination?: {
    limit: number;
    offset: number;
  };
}

/**
 * 세션 상세 조회 응답
 */
export interface GetSessionDetailResponse extends ApiResponse {
  data?: Session & {
    stats?: {
      totalCount: number;
      sensorTypeCount: number;
      firstDataTime?: number;
      lastDataTime?: number;
    };
  };
}

/**
 * 세션 종료 응답
 */
export interface EndSessionResponse extends ApiResponse {
  data?: {
    sessionId: string;
    endTime: number;
    status: "completed";
  };
}

/**
 * 세션 데이터 조회 요청
 */
export interface GetSessionDataRequest {
  sessionId: string;
  startTs?: number;
  endTs?: number;
  sensorType?: string;
  limit?: number;
  offset?: number;
}

/**
 * 세션 데이터 조회 응답
 */
export interface GetSessionDataResponse extends ApiResponse {
  data?: Array<{
    id: number;
    deviceId: string;
    sessionId: string;
    timestamp: number;
    sensorType: string;
    value: any;
    createdAt: number;
  }>;
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  session?: {
    sessionId: string;
    deviceId: string;
    status: SessionStatus;
    startTime: number;
    endTime?: number;
  };
}
