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
  deviceId: string;
  sensorType: SensorType;
  timestamp: number; // Unix timestamp (ms)
  value: SensorValue;
  metadata?: {
    accuracy?: number;
    source?: string;
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

export interface AccelerometerValue {
  x: number; // m/s²
  y: number; // m/s²
  z: number; // m/s²
}

export interface GyroscopeValue {
  x: number; // rad/s
  y: number; // rad/s
  z: number; // rad/s
}

export interface GpsValue {
  latitude: number;
  longitude: number;
  altitude?: number;
  speed?: number; // m/s
  heading?: number; // degrees
  accuracy?: number; // meters
}

export interface TemperatureValue {
  celsius: number;
  fahrenheit?: number;
}

export interface BatteryValue {
  level: number; // 0-100 percentage
  isCharging: boolean;
  temperature?: number;
}

export interface MagnetometerValue {
  x: number; // μT (micro-Tesla)
  y: number; // μT
  z: number; // μT
}

/**
 * 센서 데이터 배치
 */
export interface SensorDataBatch {
  deviceId: string;
  data: SensorData[];
  batchId?: string;
  receivedAt: number;
}

/**
 * 센서 데이터 조회 응답
 */
export interface SensorDataResponse extends ApiResponse<SensorData[]> {
  deviceId: string;
  sensorType?: SensorType;
  count: number;
}
