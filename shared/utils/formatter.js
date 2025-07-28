/**
 * 데이터 포맷팅 유틸리티
 */

/**
 * API 성공 응답 포맷
 * @param {*} data - 응답 데이터
 * @param {Object} options - 추가 옵션
 * @returns {Object} 포맷된 응답
 */
function formatSuccessResponse(data, options = {}) {
  return {
    success: true,
    data,
    timestamp: Date.now(),
    ...options,
  };
}

/**
 * API 에러 응답 포맷
 * @param {string} code - 에러 코드
 * @param {string} message - 에러 메시지
 * @param {*} details - 추가 에러 정보
 * @returns {Object} 포맷된 에러 응답
 */
function formatErrorResponse(code, message, details = null) {
  const response = {
    success: false,
    error: {
      code,
      message,
    },
    timestamp: Date.now(),
  };

  if (details) {
    response.error.details = details;
  }

  return response;
}

/**
 * 센서 데이터 응답 포맷
 * @param {Array} data - 센서 데이터 배열
 * @param {Object} query - 조회 조건
 * @returns {Object} 포맷된 센서 응답
 */
function formatSensorResponse(data, query = {}) {
  const response = formatSuccessResponse(data);

  response.deviceId = query.deviceId;
  response.sensorType = query.sensorType;
  response.count = Array.isArray(data) ? data.length : 0;

  if (query.startTime && query.endTime) {
    response.timeRange = {
      start: query.startTime,
      end: query.endTime,
    };
  }

  return response;
}

/**
 * 타임스탬프를 ISO 8601 형식으로 변환
 * @param {number} timestamp - Unix timestamp (ms)
 * @returns {string} ISO 8601 형식 문자열
 */
function formatTimestamp(timestamp) {
  return new Date(timestamp).toISOString();
}

/**
 * 센서 데이터를 CSV 형식으로 변환
 * @param {Array} data - 센서 데이터 배열
 * @param {string} sensorType - 센서 타입
 * @returns {string} CSV 형식 문자열
 */
function formatSensorDataToCsv(data, sensorType) {
  if (!Array.isArray(data) || data.length === 0) {
    return "";
  }

  // CSV 헤더 생성
  const headers = ["timestamp", "deviceId", "sensorType"];

  // 센서 타입별 값 필드 추가
  const valueHeaders = getValueHeaders(sensorType);
  headers.push(...valueHeaders);

  // CSV 행 생성
  const rows = data.map((item) => {
    const row = [
      formatTimestamp(item.timestamp),
      item.deviceId,
      item.sensorType,
    ];

    // 센서 값 추가
    valueHeaders.forEach((header) => {
      row.push(item.value[header] || "");
    });

    return row.join(",");
  });

  // 헤더와 행 결합
  return [headers.join(","), ...rows].join("\n");
}

/**
 * 센서 타입별 값 헤더 반환
 * @param {string} sensorType - 센서 타입
 * @returns {Array} 헤더 배열
 */
function getValueHeaders(sensorType) {
  const headerMap = {
    accelerometer: ["x", "y", "z"],
    gyroscope: ["x", "y", "z"],
    magnetometer: ["x", "y", "z"],
    gps: ["latitude", "longitude", "altitude", "speed", "heading", "accuracy"],
    temperature: ["celsius", "fahrenheit"],
    battery: ["level", "isCharging", "temperature"],
  };

  return headerMap[sensorType] || ["value"];
}

/**
 * 바이트 크기를 사람이 읽기 쉬운 형식으로 변환
 * @param {number} bytes - 바이트 크기
 * @param {number} decimals - 소수점 자리수
 * @returns {string} 포맷된 크기 문자열
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * 시간 간격을 사람이 읽기 쉬운 형식으로 변환
 * @param {number} milliseconds - 밀리초
 * @returns {string} 포맷된 시간 문자열
 */
function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}일 ${hours % 24}시간`;
  } else if (hours > 0) {
    return `${hours}시간 ${minutes % 60}분`;
  } else if (minutes > 0) {
    return `${minutes}분 ${seconds % 60}초`;
  } else {
    return `${seconds}초`;
  }
}

/**
 * 페이지네이션 메타 정보 생성
 * @param {number} page - 현재 페이지
 * @param {number} pageSize - 페이지 크기
 * @param {number} totalItems - 전체 항목 수
 * @returns {Object} 페이지네이션 메타
 */
function createPaginationMeta(page, pageSize, totalItems) {
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

module.exports = {
  formatSuccessResponse,
  formatErrorResponse,
  formatSensorResponse,
  formatTimestamp,
  formatSensorDataToCsv,
  formatBytes,
  formatDuration,
  createPaginationMeta,
};
