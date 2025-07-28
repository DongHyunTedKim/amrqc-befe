/**
 * AMR QC 솔루션 기본 타입 정의
 */

/**
 * API 응답 기본 구조
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
}

/**
 * 페이지네이션 메타 정보
 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

/**
 * 페이지네이션된 응답
 */
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: PaginationMeta;
}

/**
 * 시간 범위 조회 파라미터
 */
export interface TimeRangeQuery {
  startTime: number; // Unix timestamp (ms)
  endTime: number; // Unix timestamp (ms)
  deviceId?: string;
  sensorType?: string;
}

/**
 * WebSocket 메시지 기본 구조
 */
export interface WsMessage<T = any> {
  type: "data" | "error" | "ack" | "ping" | "pong";
  payload?: T;
  messageId?: string;
  timestamp: number;
}
