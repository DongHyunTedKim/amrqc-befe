# AMR QC 솔루션 - 도메인 주도 설계 및 공통 모듈 문서

## 1. 도메인 경계 (Bounded Context)

AMR QC 솔루션은 다음과 같은 도메인 경계로 구분됩니다:

### 1.1 센서 도메인 (Sensor Domain)

- **책임**: 센서 데이터의 수집, 검증, 변환
- **주요 개념**: SensorData, SensorType, DataValidation
- **위치**: `/server/routes/sensor.js`, `/shared/types/sensor.d.ts`

### 1.2 디바이스 도메인 (Device Domain)

- **책임**: AMR 디바이스 식별, 관리, 상태 추적
- **주요 개념**: DeviceId, DeviceStatus, DeviceRegistry
- **위치**: `/server/routes/device.js`, `/shared/types/device.d.ts`

### 1.3 타임라인 도메인 (Timeline Domain)

- **책임**: 시계열 데이터 조회, 집계, 시각화 지원
- **주요 개념**: TimeRange, DataPoint, AggregationStrategy
- **위치**: `/server/routes/timeline.js`, `/client/src/features/timeline/`

## 2. Routes 중심 모듈화 전략

MVP 단계에서는 빠른 개발을 위해 routes 파일에 비즈니스 로직을 통합합니다:

```
server/
├── routes/
│   ├── sensor.js       # 센서 데이터 수신/저장 (WebSocket + REST)
│   ├── device.js       # 디바이스 관리 API
│   ├── timeline.js     # 타임라인 조회 API
│   └── download.js     # 데이터 다운로드 API
```

### 2.1 라우트 모듈 구조 예시

```javascript
// server/routes/sensor.js
const express = require("express");
const router = express.Router();
const { validateSensorData } = require("../../shared/utils/validator");
const { formatSensorResponse } = require("../../shared/utils/formatter");

// WebSocket 핸들러
function handleSensorStream(ws, req) {
  ws.on("message", (data) => {
    const parsed = JSON.parse(data);
    if (validateSensorData(parsed)) {
      // 비즈니스 로직 직접 구현
      saveSensorData(parsed);
      ws.send(JSON.stringify({ status: "ok" }));
    }
  });
}

// REST API 엔드포인트
router.get("/sensors/:deviceId", (req, res) => {
  // 라우트에서 직접 처리
  const data = getSensorData(req.params.deviceId);
  res.json(formatSensorResponse(data));
});

module.exports = { router, handleSensorStream };
```

### 2.2 향후 서비스 레이어 분리 전략

Phase 2에서 복잡도가 증가하면 서비스 레이어로 분리:

```javascript
// Phase 2 리팩토링 예시
// server/services/sensorService.js
class SensorService {
  async processSensorData(data) {
    // 복잡한 비즈니스 로직
  }
}
```

## 3. 공통 모듈 설계

### 3.1 Type 정의 (/shared/types)

타입 정의는 클라이언트와 서버 간 계약을 명확히 합니다:

```typescript
// shared/types/base.d.ts
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: number;
}

// shared/types/sensor.d.ts
export interface SensorData {
  deviceId: string;
  sensorType: "accelerometer" | "gyroscope" | "gps" | "temperature";
  timestamp: number;
  value: {
    [key: string]: number | string;
  };
}
```

### 3.2 유틸리티 함수 (/shared/utils)

재사용 가능한 유틸리티 함수들:

```javascript
// shared/utils/validator.js
const validators = {
  accelerometer: (data) => {
    return (
      data.value.x !== undefined &&
      data.value.y !== undefined &&
      data.value.z !== undefined
    );
  },

  temperature: (data) => {
    return (
      data.value.celsius !== undefined && typeof data.value.celsius === "number"
    );
  },
};

function validateSensorData(data) {
  if (!data.deviceId || !data.sensorType || !data.timestamp) {
    return false;
  }

  const validator = validators[data.sensorType];
  return validator ? validator(data) : false;
}

module.exports = { validateSensorData, validators };
```

## 4. 로깅 및 에러 처리 패턴

### 4.1 Winston 로깅 설정

```javascript
// server/middleware/logger.js
const winston = require("winston");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Express 미들웨어
const requestLogger = (req, res, next) => {
  logger.info({
    method: req.method,
    url: req.url,
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });
  next();
};

module.exports = { logger, requestLogger };
```

### 4.2 에러 처리 패턴

```javascript
// server/middleware/error.js
const { logger } = require("./logger");

class AppError extends Error {
  constructor(message, statusCode, errorCode) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = true;
  }
}

const errorHandler = (err, req, res, next) => {
  const { statusCode = 500, message, errorCode = "INTERNAL_ERROR" } = err;

  logger.error({
    error: {
      message: err.message,
      stack: err.stack,
      statusCode,
      errorCode,
    },
    request: {
      method: req.method,
      url: req.url,
      body: req.body,
    },
  });

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message:
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : message,
    },
    timestamp: Date.now(),
  });
};

module.exports = { AppError, errorHandler };
```

## 5. 모듈 간 인터페이스

### 5.1 의존성 흐름

```
Client (Next.js)
    ↓ (REST/WebSocket)
Server Routes
    ↓ (Direct call in MVP)
Business Logic (in routes)
    ↓ (Direct call)
Database (SQLite)
```

### 5.2 데이터 흐름 예시

```javascript
// 1. 클라이언트에서 요청
fetch("/api/sensors/AMR-001");

// 2. 라우트에서 처리
router.get("/sensors/:deviceId", async (req, res) => {
  try {
    // 3. 검증
    if (!isValidDeviceId(req.params.deviceId)) {
      throw new AppError("Invalid device ID", 400, "INVALID_DEVICE");
    }

    // 4. 데이터 조회
    const data = await getSensorData(req.params.deviceId);

    // 5. 포맷팅 및 응답
    res.json(formatSensorResponse(data));
  } catch (error) {
    next(error);
  }
});
```

## 6. 확장 전략

### Phase 1 (현재)

- Routes에 비즈니스 로직 포함
- 간단한 유틸리티 함수 사용
- 기본적인 타입 정의

### Phase 2

- Service 레이어 도입
- Repository 패턴 적용
- 의존성 주입 고려

### Phase 3

- 마이크로서비스 아키텍처 검토
- 이벤트 드리븐 아키텍처 도입
- CQRS 패턴 적용 검토
