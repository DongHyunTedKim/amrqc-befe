-- AMR QC 솔루션 - 새로운 센서 타입 추가 마이그레이션
-- 실행 전 백업 권장: sqlite3 data.db ".backup data_backup.db"

-- 1. 기존 CHECK 제약 제거
-- SQLite는 ALTER TABLE DROP CONSTRAINT를 지원하지 않으므로
-- 테이블을 재생성해야 합니다.

-- 트랜잭션 시작
BEGIN TRANSACTION;

-- 1.1 기존 테이블 백업
CREATE TABLE SensorData_backup AS SELECT * FROM SensorData;

-- 1.2 기존 테이블 삭제
DROP TABLE SensorData;

-- 1.3 확장된 센서 타입으로 테이블 재생성
CREATE TABLE SensorData (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId TEXT NOT NULL,
    ts INTEGER NOT NULL,
    sensorType TEXT NOT NULL,
    valueJson TEXT NOT NULL,
    createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    CONSTRAINT chk_sensorType CHECK (sensorType IN (
        'accelerometer', 'gyroscope', 'gps', 'temperature', 
        'battery', 'magnetometer',
        -- 새로운 센서 타입 추가
        'proximity',      -- 근접 센서
        'light',          -- 조도 센서
        'pressure',       -- 압력 센서
        'humidity',       -- 습도 센서
        'camera',         -- 카메라 (메타데이터만)
        'microphone'      -- 마이크 (메타데이터만)
    ))
);

-- 1.4 인덱스 재생성
CREATE INDEX idx_sensor_device_time ON SensorData(deviceId, ts);
CREATE INDEX idx_sensor_type_time ON SensorData(sensorType, ts);
CREATE INDEX idx_sensor_device_type_time ON SensorData(deviceId, sensorType, ts);
CREATE INDEX idx_sensor_time ON SensorData(ts);

-- 1.5 데이터 복원
INSERT INTO SensorData SELECT * FROM SensorData_backup;

-- 1.6 백업 테이블 삭제
DROP TABLE SensorData_backup;

-- 2. 스키마 버전 업데이트 (선택사항)
INSERT INTO SchemaVersion (version, description) 
VALUES (1, '새로운 센서 타입 추가: proximity, light, pressure, humidity, camera, microphone');

-- 트랜잭션 커밋
COMMIT;

-- 3. 새로운 센서 타입 샘플 데이터 (테스트용)
/*
-- 근접 센서 데이터
INSERT INTO SensorData (deviceId, ts, sensorType, valueJson) VALUES
('AMR-001', strftime('%s', 'now') * 1000, 'proximity', 
 '{"distance": 5.2, "unit": "cm", "detected": true}');

-- 조도 센서 데이터
INSERT INTO SensorData (deviceId, ts, sensorType, valueJson) VALUES
('AMR-001', strftime('%s', 'now') * 1000 + 100, 'light', 
 '{"lux": 320, "colorTemp": 5500}');

-- 압력 센서 데이터
INSERT INTO SensorData (deviceId, ts, sensorType, valueJson) VALUES
('AMR-001', strftime('%s', 'now') * 1000 + 200, 'pressure', 
 '{"pressure": 1013.25, "unit": "hPa", "altitude": 45.5}');

-- 습도 센서 데이터
INSERT INTO SensorData (deviceId, ts, sensorType, valueJson) VALUES
('AMR-001', strftime('%s', 'now') * 1000 + 300, 'humidity', 
 '{"humidity": 65.2, "unit": "%", "temperature": 23.5}');
*/ 