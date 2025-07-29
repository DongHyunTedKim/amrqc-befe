# AMR QC 솔루션 - 데이터베이스 스키마 설계 문서

## 1. 데이터베이스 개요

- **데이터베이스 엔진**: SQLite 3
- **데이터베이스 파일**: `data.db`
- **라이브러리**: better-sqlite3
- **주요 특징**:
  - 임베디드 데이터베이스 (서버 불필요)
  - 트랜잭션 지원
  - 동기식 API (better-sqlite3)
  - 단일 파일 기반

## 2. 테이블 스키마

### 2.1 SensorData 테이블

센서 데이터를 저장하는 핵심 테이블입니다.

```sql
CREATE TABLE IF NOT EXISTS SensorData (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT NOT NULL,
    ts INTEGER NOT NULL,                    -- Unix timestamp (milliseconds)
    sensorType TEXT NOT NULL,
    valueJson TEXT NOT NULL,                -- JSON 형태의 센서 값
    createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    CONSTRAINT chk_sensorType CHECK (sensorType IN ('accelerometer', 'gyroscope', 'gps', 'temperature', 'battery', 'magnetometer'))
);
```

### 2.2 Devices 테이블 (선택사항)

디바이스 메타 정보를 관리하는 테이블입니다.

```sql
CREATE TABLE IF NOT EXISTS Devices (
    deviceId TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',
    registeredAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    lastSeenAt INTEGER,
    metadata TEXT,                          -- JSON 형태의 추가 정보
    CONSTRAINT chk_status CHECK (status IN ('active', 'inactive', 'maintenance', 'error'))
);
```

### 2.3 DataSummary 테이블 (선택사항)

집계 데이터를 저장하는 테이블입니다.

```sql
CREATE TABLE IF NOT EXISTS DataSummary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT NOT NULL,
    sensorType TEXT NOT NULL,
    date TEXT NOT NULL,                     -- YYYY-MM-DD 형식
    dataCount INTEGER DEFAULT 0,
    firstDataAt INTEGER,
    lastDataAt INTEGER,
    UNIQUE(deviceId, sensorType, date)
);
```

## 3. 인덱스 설계

### 3.1 주요 인덱스

```sql
-- 디바이스별 시간 범위 조회용
CREATE INDEX idx_sensor_device_time ON SensorData(deviceId, ts);

-- 센서 타입별 시간 범위 조회용
CREATE INDEX idx_sensor_type_time ON SensorData(sensorType, ts);

-- 복합 조회용 (디바이스 + 센서 타입 + 시간)
CREATE INDEX idx_sensor_device_type_time ON SensorData(deviceId, sensorType, ts);

-- 시간 기반 조회용
CREATE INDEX idx_sensor_time ON SensorData(ts);
```

### 3.2 인덱스 선택 근거

| 쿼리 패턴                   | 사용 인덱스                 | 설명                             |
| --------------------------- | --------------------------- | -------------------------------- |
| 특정 디바이스의 데이터 조회 | idx_sensor_device_time      | deviceId로 필터링 후 시간순 정렬 |
| 특정 센서 타입 조회         | idx_sensor_type_time        | sensorType으로 필터링            |
| 시간 범위 조회              | idx_sensor_time             | 전체 데이터에서 시간 범위 필터   |
| 복합 조건 조회              | idx_sensor_device_type_time | 디바이스 + 센서 타입 동시 필터   |

## 4. better-sqlite3 연결 코드

### 4.1 데이터베이스 초기화

```javascript
// server/db.js
const Database = require("better-sqlite3");
const path = require("path");

class DatabaseManager {
  constructor(dbPath = "./data.db") {
    this.db = new Database(dbPath, {
      verbose: console.log, // SQL 로깅 (개발 환경)
      fileMustExist: false, // 파일이 없으면 생성
    });

    // WAL 모드 활성화 (동시성 향상)
    this.db.pragma("journal_mode = WAL");

    // 외래 키 제약 활성화
    this.db.pragma("foreign_keys = ON");

    // 성능 최적화
    this.db.pragma("synchronous = NORMAL");
    this.db.pragma("cache_size = 10000");

    this.initSchema();
    this.prepareStatements();
  }

  initSchema() {
    // 테이블 생성
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS SensorData (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deviceId TEXT NOT NULL,
        ts INTEGER NOT NULL,
        sensorType TEXT NOT NULL,
        valueJson TEXT NOT NULL,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        CONSTRAINT chk_sensorType CHECK (sensorType IN ('accelerometer', 'gyroscope', 'gps', 'temperature', 'battery', 'magnetometer'))
      );
    `);

    // 인덱스 생성
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sensor_device_time ON SensorData(deviceId, ts);
      CREATE INDEX IF NOT EXISTS idx_sensor_type_time ON SensorData(sensorType, ts);
      CREATE INDEX IF NOT EXISTS idx_sensor_device_type_time ON SensorData(deviceId, sensorType, ts);
      CREATE INDEX IF NOT EXISTS idx_sensor_time ON SensorData(ts);
    `);
  }

  prepareStatements() {
    // 자주 사용하는 쿼리를 미리 준비
    this.statements = {
      insertSensor: this.db.prepare(`
        INSERT INTO SensorData (deviceId, ts, sensorType, valueJson)
        VALUES (?, ?, ?, ?)
      `),

      getSensorByDevice: this.db.prepare(`
        SELECT * FROM SensorData
        WHERE deviceId = ? AND ts >= ? AND ts <= ?
        ORDER BY ts DESC
        LIMIT ?
      `),

      getSensorByType: this.db.prepare(`
        SELECT * FROM SensorData
        WHERE sensorType = ? AND ts >= ? AND ts <= ?
        ORDER BY ts DESC
        LIMIT ?
      `),

      getLatestByDevice: this.db.prepare(`
        SELECT * FROM SensorData
        WHERE deviceId = ?
        ORDER BY ts DESC
        LIMIT 1
      `),
    };
  }

  // 트랜잭션을 사용한 배치 삽입
  insertBatch(dataArray) {
    const insert = this.db.transaction((data) => {
      for (const item of data) {
        this.statements.insertSensor.run(
          item.deviceId,
          item.timestamp,
          item.sensorType,
          JSON.stringify(item.value)
        );
      }
    });

    return insert(dataArray);
  }

  close() {
    this.db.close();
  }
}

module.exports = DatabaseManager;
```

### 4.2 사용 예시

```javascript
// server/routes/sensor.js
const DatabaseManager = require("../db");
const db = new DatabaseManager();

// 단일 데이터 삽입
function insertSensorData(data) {
  try {
    const result = db.statements.insertSensor.run(
      data.deviceId,
      data.timestamp,
      data.sensorType,
      JSON.stringify(data.value)
    );
    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error("Insert error:", error);
    return { success: false, error: error.message };
  }
}

// 배치 데이터 삽입
function insertBatchData(dataArray) {
  try {
    db.insertBatch(dataArray);
    return { success: true, count: dataArray.length };
  } catch (error) {
    console.error("Batch insert error:", error);
    return { success: false, error: error.message };
  }
}

// 데이터 조회
function getSensorData(deviceId, startTime, endTime, limit = 1000) {
  try {
    const rows = db.statements.getSensorByDevice.all(
      deviceId,
      startTime,
      endTime,
      limit
    );

    // JSON 파싱
    return rows.map((row) => ({
      ...row,
      value: JSON.parse(row.valueJson),
    }));
  } catch (error) {
    console.error("Query error:", error);
    return [];
  }
}
```

## 5. 샘플 데이터

### 5.1 샘플 INSERT 문

```sql
-- 가속도계 데이터
INSERT INTO SensorData (deviceId, ts, sensorType, valueJson) VALUES
('AMR-001', 1640995200000, 'accelerometer', '{"x": 0.98, "y": -0.15, "z": 9.81}'),
('AMR-001', 1640995200100, 'accelerometer', '{"x": 0.97, "y": -0.14, "z": 9.82}'),
('AMR-001', 1640995200200, 'accelerometer', '{"x": 0.99, "y": -0.16, "z": 9.80}');

-- GPS 데이터
INSERT INTO SensorData (deviceId, ts, sensorType, valueJson) VALUES
('AMR-001', 1640995200000, 'gps', '{"latitude": 37.5665, "longitude": 126.9780, "altitude": 45.2, "accuracy": 5.0}'),
('AMR-002', 1640995201000, 'gps', '{"latitude": 37.5666, "longitude": 126.9781, "altitude": 45.5, "accuracy": 4.5}');

-- 온도 데이터
INSERT INTO SensorData (deviceId, ts, sensorType, valueJson) VALUES
('AMR-001', 1640995200000, 'temperature', '{"celsius": 23.5, "fahrenheit": 74.3}'),
('AMR-001', 1640995210000, 'temperature', '{"celsius": 23.7, "fahrenheit": 74.7}');

-- 배터리 데이터
INSERT INTO SensorData (deviceId, ts, sensorType, valueJson) VALUES
('AMR-001', 1640995200000, 'battery', '{"level": 85, "isCharging": false, "temperature": 28.5}'),
('AMR-002', 1640995200000, 'battery', '{"level": 92, "isCharging": true, "temperature": 30.1}');
```

### 5.2 샘플 쿼리

```sql
-- 특정 디바이스의 최근 데이터 조회
SELECT id, deviceId, datetime(ts/1000, 'unixepoch', 'localtime') as timestamp,
       sensorType, valueJson
FROM SensorData
WHERE deviceId = 'AMR-001'
ORDER BY ts DESC
LIMIT 10;

-- 시간 범위 내 특정 센서 데이터 조회
SELECT * FROM SensorData
WHERE sensorType = 'accelerometer'
  AND ts >= 1640995200000
  AND ts <= 1640995300000
ORDER BY ts;

-- 디바이스별 데이터 수 집계
SELECT deviceId, sensorType, COUNT(*) as count,
       MIN(ts) as firstData, MAX(ts) as lastData
FROM SensorData
GROUP BY deviceId, sensorType;

-- JSON 값 추출 예시 (SQLite 3.38.0+)
SELECT deviceId, ts,
       json_extract(valueJson, '$.x') as x,
       json_extract(valueJson, '$.y') as y,
       json_extract(valueJson, '$.z') as z
FROM SensorData
WHERE sensorType = 'accelerometer';
```

## 6. 성능 고려사항

### 6.1 쓰기 성능 최적화

1. **배치 처리**: 개별 INSERT 대신 트랜잭션으로 묶어서 처리
2. **WAL 모드**: Write-Ahead Logging으로 동시성 향상
3. **Prepared Statements**: SQL 파싱 오버헤드 감소

### 6.2 읽기 성능 최적화

1. **적절한 인덱스**: 쿼리 패턴에 맞는 인덱스 설계
2. **LIMIT 사용**: 대량 데이터 조회 시 제한
3. **페이지네이션**: 오프셋 기반 페이징

### 6.3 용량 관리

1. **데이터 보존 정책**:

   - 30일 이상 된 데이터 자동 삭제 (선택사항)
   - 아카이브 테이블로 이동

2. **VACUUM**:
   - 주기적으로 실행하여 파일 크기 최적화
   - `VACUUM` 또는 `PRAGMA auto_vacuum = FULL`

## 7. 데이터베이스 유지보수

### 7.1 백업 전략

```javascript
// 데이터베이스 백업
function backupDatabase() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `./backups/data_${timestamp}.db`;

  db.backup(backupPath)
    .then(() => console.log("Backup completed"))
    .catch((err) => console.error("Backup failed:", err));
}
```

### 7.2 데이터 정리

```sql
-- 30일 이상 된 데이터 삭제
DELETE FROM SensorData
WHERE ts < (strftime('%s', 'now') * 1000 - 30 * 24 * 60 * 60 * 1000);

-- 데이터베이스 최적화
VACUUM;
ANALYZE;
```

## 8. 제약사항 및 한계

1. **동시 쓰기**: SQLite는 단일 쓰기 트랜잭션만 지원
2. **파일 크기**: 단일 파일로 관리되므로 크기 증가 주의
3. **네트워크 접근**: 로컬 파일 시스템에서만 안정적
4. **최대 크기**: 이론적으로 281TB까지 가능하나 실용적으로는 수 GB 권장
