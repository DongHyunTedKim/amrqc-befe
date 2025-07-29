/**
 * 데이터베이스 스키마 타입 정의
 */

/**
 * SensorData 테이블 레코드
 */
export interface SensorDataRecord {
  id: number;
  deviceId: string;
  ts: number; // Unix timestamp (ms)
  sensorType: string;
  valueJson: string; // JSON string
  createdAt: number;
}

/**
 * Devices 테이블 레코드
 */
export interface DeviceRecord {
  deviceId: string;
  name?: string;
  description?: string;
  status: "active" | "inactive" | "maintenance" | "error";
  registeredAt: number;
  lastSeenAt?: number;
  metadata?: string; // JSON string
}

/**
 * DataSummary 테이블 레코드
 */
export interface DataSummaryRecord {
  id: number;
  deviceId: string;
  sensorType: string;
  date: string; // YYYY-MM-DD
  dataCount: number;
  firstDataAt?: number;
  lastDataAt?: number;
}

/**
 * 쿼리 결과 타입
 */
export interface QueryResult<T> {
  rows: T[];
  count: number;
  error?: string;
}

/**
 * 배치 삽입 결과
 */
export interface BatchInsertResult {
  success: boolean;
  count?: number;
  error?: string;
}

/**
 * 데이터베이스 통계
 */
export interface DatabaseStats {
  totalRecords: number;
  totalDevices: number;
  sensorTypeCounts: Record<string, number>;
  fileSizeBytes: number;
  oldestRecord?: number;
  newestRecord?: number;
}
