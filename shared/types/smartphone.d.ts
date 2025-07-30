// shared/types/smartphone.d.ts

import { ApiResponse } from "./base";

/**
 * 스마트폰 상태
 */
export type SmartphoneStatus = "active" | "inactive" | "maintenance" | "error";

/**
 * 스마트폰 기본 정보
 */
export interface Smartphone {
  smartphoneId: string; // 스마트폰 고유 ID
  name?: string; // 사용자가 지정한 이름 (예: "테스트폰 1호")
  description?: string;
  status: SmartphoneStatus;
  lastSeenAt?: number;
  registeredAt: number;
  currentAmrId?: string; // 현재 거치된 AMR의 ID
  metadata?: {
    model?: string; // 스마트폰 모델명 (예: "Galaxy S23")
    osVersion?: string; // OS 버전
    appVersion?: string; // AMR QC 앱 버전
    location?: string;
    [key: string]: any;
  };
}

/**
 * 스마트폰 등록 요청
 */
export interface SmartphoneRegistrationRequest {
  smartphoneId: string;
  name?: string;
  model?: string;
  metadata?: Record<string, any>;
}

/**
 * 스마트폰 상태 업데이트
 */
export interface SmartphoneStatusUpdate {
  status?: SmartphoneStatus;
  currentAmrId?: string;
  lastSeenAt?: number;
}

/**
 * 스마트폰 목록 조회 응답
 */
export interface SmartphoneListResponse extends ApiResponse<Smartphone[]> {
  activeCount: number;
  totalCount: number;
}

/**
 * AMR 정보 (스마트폰이 거치되는 장비)
 */
export interface AMR {
  amrId: string; // AMR 고유 ID (예: "AMR-001")
  name?: string; // AMR 이름 (예: "제조라인 A - 1번 AMR")
  location?: string; // AMR 위치
  description?: string;
  metadata?: {
    manufacturer?: string;
    model?: string;
    [key: string]: any;
  };
}
