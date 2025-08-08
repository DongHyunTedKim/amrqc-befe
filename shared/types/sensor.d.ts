/**
 * 센서 데이터 타입 정의
 */

import { ApiResponse } from "./base";

/**
 * 지원하는 센서 타입
 */
export type SensorType =
  | "accelerometer"
  | "gyroscope"
  | "gps"
  | "temperature"
  | "battery"
  | "magnetometer";

/**
 * 센서 데이터 기본 구조
 */
export interface SensorData {
  id?: string;
  deviceId: string; // 스마트폰의 고유 ID (AMR ID가 아님!)
  sessionId?: string; // 세션 ID
  sensorType: SensorType;
  timestamp: number; // Unix timestamp (ms)
  value: SensorValue;
  metadata?: {
    accuracy?: number;
    source?: string;
    amrId?: string; // 스마트폰이 거치된 AMR의 ID
    [key: string]: any;
  };
}

/**
 * 센서별 값 타입 정의
 */
export type SensorValue =
  | AccelerometerValue
  | GyroscopeValue
  | GpsValue
  | TemperatureValue
  | BatteryValue
  | MagnetometerValue;

/**
 * 가속도계 값
 */
export interface AccelerometerValue {
  x: number; // m/s²
  y: number; // m/s²
  z: number; // m/s²
}

/**
 * 자이로스코프 값
 */
export interface GyroscopeValue {
  x: number; // rad/s
  y: number; // rad/s
  z: number; // rad/s
}

/**
 * GPS 값
 */
export interface GpsValue {
  latitude: number; // 위도
  longitude: number; // 경도
  altitude?: number; // 고도 (meters)
  accuracy?: number; // 정확도 (meters)
  speed?: number; // 속도 (m/s)
}

/**
 * 온도 값
 */
export interface TemperatureValue {
  celsius: number;
  fahrenheit?: number;
}

/**
 * 배터리 값
 */
export interface BatteryValue {
  level: number; // 0-100 (%)
  isCharging: boolean;
  temperature?: number; // celsius
}

/**
 * 지자기 센서 값
 */
export interface MagnetometerValue {
  x: number; // μT
  y: number; // μT
  z: number; // μT
}

/**
 * 센서 데이터 배치
 */
export interface SensorDataBatch {
  deviceId: string; // 스마트폰 ID
  data: SensorData[];
  batchId?: string;
  receivedAt: number;
}

/**
 * 센서 데이터 조회 응답
 */
export interface SensorDataResponse extends ApiResponse<SensorData[]> {
  deviceId: string; // 스마트폰 ID
  sensorType?: SensorType;
  amrId?: string; // 조회 필터로 사용된 AMR ID
}
