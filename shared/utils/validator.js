/**
 * 데이터 검증 유틸리티
 */

/**
 * 센서별 검증 함수
 */
const validators = {
  accelerometer: (data) => {
    if (!data.value || typeof data.value !== "object") return false;
    return (
      typeof data.value.x === "number" &&
      typeof data.value.y === "number" &&
      typeof data.value.z === "number"
    );
  },

  gyroscope: (data) => {
    if (!data.value || typeof data.value !== "object") return false;
    return (
      typeof data.value.x === "number" &&
      typeof data.value.y === "number" &&
      typeof data.value.z === "number"
    );
  },

  gps: (data) => {
    if (!data.value || typeof data.value !== "object") return false;
    return (
      typeof data.value.latitude === "number" &&
      typeof data.value.longitude === "number" &&
      data.value.latitude >= -90 &&
      data.value.latitude <= 90 &&
      data.value.longitude >= -180 &&
      data.value.longitude <= 180
    );
  },

  temperature: (data) => {
    if (!data.value || typeof data.value !== "object") return false;
    return (
      typeof data.value.celsius === "number" && data.value.celsius >= -273.15 // 절대 영도 이상
    );
  },

  battery: (data) => {
    if (!data.value || typeof data.value !== "object") return false;
    return (
      typeof data.value.level === "number" &&
      data.value.level >= 0 &&
      data.value.level <= 100 &&
      (data.value.temperature === undefined ||
        typeof data.value.temperature === "number") &&
      (data.value.voltage === undefined ||
        typeof data.value.voltage === "number")
    );
  },

  magnetometer: (data) => {
    if (!data.value || typeof data.value !== "object") return false;
    return (
      typeof data.value.x === "number" &&
      typeof data.value.y === "number" &&
      typeof data.value.z === "number"
    );
  },

  microphone: (data) => {
    if (!data.value || typeof data.value !== "object") return false;
    return (
      typeof data.value.decibel === "number" &&
      typeof data.value.maxDecibel === "number" &&
      data.value.decibel >= 0 &&
      data.value.maxDecibel >= 0 &&
      data.value.decibel <= data.value.maxDecibel
    );
  },
};

/**
 * 센서 데이터 유효성 검증
 * @param {Object} data - 검증할 센서 데이터
 * @returns {boolean} 유효성 여부
 */
function validateSensorData(data) {
  // 필수 필드 검증
  if (!data || typeof data !== "object") {
    return false;
  }

  if (!data.deviceId || typeof data.deviceId !== "string") {
    return false;
  }

  if (!data.sensorType || typeof data.sensorType !== "string") {
    return false;
  }

  if (
    !data.timestamp ||
    typeof data.timestamp !== "number" ||
    data.timestamp <= 0
  ) {
    return false;
  }

  // 센서 타입별 검증
  const validator = validators[data.sensorType];
  if (!validator) {
    return false; // 지원하지 않는 센서 타입
  }

  return validator(data);
}

/**
 * 디바이스 ID 유효성 검증
 * @param {string} deviceId - 검증할 디바이스 ID
 * @returns {boolean} 유효성 여부
 */
function isValidDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== "string") {
    return false;
  }

  // 디바이스 ID 형식: AMR-XXXX (예: AMR-001, AMR-1234)
  const deviceIdPattern = /^AMR-\d{1,4}$/;
  return deviceIdPattern.test(deviceId);
}

/**
 * 타임스탬프 범위 검증
 * @param {number} startTime - 시작 시간
 * @param {number} endTime - 종료 시간
 * @returns {boolean} 유효성 여부
 */
function isValidTimeRange(startTime, endTime) {
  if (typeof startTime !== "number" || typeof endTime !== "number") {
    return false;
  }

  if (startTime <= 0 || endTime <= 0) {
    return false;
  }

  if (startTime >= endTime) {
    return false;
  }

  // 최대 조회 기간: 30일
  const maxRangeMs = 30 * 24 * 60 * 60 * 1000;
  if (endTime - startTime > maxRangeMs) {
    return false;
  }

  return true;
}

/**
 * 배치 데이터 검증
 * @param {Object} batch - 검증할 배치 데이터
 * @returns {boolean} 유효성 여부
 */
function validateBatchData(batch) {
  if (!batch || typeof batch !== "object") {
    return false;
  }

  if (!batch.deviceId || !isValidDeviceId(batch.deviceId)) {
    return false;
  }

  if (!Array.isArray(batch.data) || batch.data.length === 0) {
    return false;
  }

  // 최대 배치 크기: 1000개
  if (batch.data.length > 1000) {
    return false;
  }

  // 모든 데이터 검증
  return batch.data.every((item) => validateSensorData(item));
}

module.exports = {
  validateSensorData,
  isValidDeviceId,
  isValidTimeRange,
  validateBatchData,
  validators,
};
