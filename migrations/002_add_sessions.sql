-- AMR QC 솔루션 - 세션 기반 데이터 관리 마이그레이션
-- DeviceID + 시작시간 기반의 데이터셋 세션 관리 추가
-- 실행 전 백업 권장: sqlite3 data.db ".backup data_backup_v2.db"

-- 트랜잭션 시작
BEGIN TRANSACTION;

-- 1. Sessions 테이블 생성
CREATE TABLE IF NOT EXISTS Sessions (
    sessionId TEXT PRIMARY KEY,           -- UUID 형태의 세션 ID
    deviceId TEXT NOT NULL,               -- 디바이스 ID
    startTime INTEGER NOT NULL,           -- 세션 시작 시간 (Unix timestamp ms)
    endTime INTEGER,                      -- 세션 종료 시간 (NULL = 진행중)
    status TEXT DEFAULT 'active',         -- active, completed, error
    description TEXT,                     -- 세션 설명 (선택사항)
    metadata TEXT,                        -- JSON 형태의 추가 메타데이터
    createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    CONSTRAINT chk_session_status CHECK (status IN ('active', 'completed', 'error', 'paused'))
);

-- 2. SensorData 테이블에 sessionId 컬럼 추가
-- SQLite ALTER TABLE ADD COLUMN 사용
ALTER TABLE SensorData ADD COLUMN sessionId TEXT;

-- 3. 인덱스 추가
-- 세션 기반 조회를 위한 인덱스
CREATE INDEX idx_sessions_device_time ON Sessions(deviceId, startTime);
CREATE INDEX idx_sessions_status ON Sessions(status);
CREATE INDEX idx_sessions_device_status ON Sessions(deviceId, status);

-- 센서 데이터의 sessionId 인덱스
CREATE INDEX idx_sensor_session_time ON SensorData(sessionId, ts);
CREATE INDEX idx_sensor_session_type ON SensorData(sessionId, sensorType);

-- 4. 기존 데이터를 위한 기본 세션 생성
-- 기존 deviceId별로 첫 번째 데이터 시간을 기준으로 세션 생성
INSERT INTO Sessions (sessionId, deviceId, startTime, endTime, status, description)
SELECT 
    'legacy-' || deviceId || '-' || MIN(ts) as sessionId,
    deviceId,
    MIN(ts) as startTime,
    MAX(ts) as endTime,
    'completed' as status,
    'Legacy data session (auto-generated)' as description
FROM SensorData 
WHERE sessionId IS NULL
GROUP BY deviceId;

-- 5. 기존 SensorData에 sessionId 할당
UPDATE SensorData 
SET sessionId = (
    SELECT sessionId 
    FROM Sessions 
    WHERE Sessions.deviceId = SensorData.deviceId 
    AND Sessions.description LIKE 'Legacy data session%'
    LIMIT 1
)
WHERE sessionId IS NULL;

-- 6. 스키마 버전 업데이트
CREATE TABLE IF NOT EXISTS SchemaVersion (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version INTEGER NOT NULL,
    description TEXT,
    appliedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

INSERT INTO SchemaVersion (version, description) 
VALUES (2, '세션 기반 데이터 관리 추가: Sessions 테이블, SensorData에 sessionId 컬럼 추가');

-- 트랜잭션 커밋
COMMIT;

-- 7. 데이터 검증 쿼리 (마이그레이션 후 실행 권장)
/*
-- 세션 생성 확인
SELECT COUNT(*) as session_count FROM Sessions;

-- sessionId가 모든 센서 데이터에 할당되었는지 확인
SELECT COUNT(*) as data_with_session FROM SensorData WHERE sessionId IS NOT NULL;
SELECT COUNT(*) as data_without_session FROM SensorData WHERE sessionId IS NULL;

-- 세션별 데이터 요약
SELECT 
    s.sessionId,
    s.deviceId,
    s.status,
    datetime(s.startTime/1000, 'unixepoch', 'localtime') as startTime,
    datetime(s.endTime/1000, 'unixepoch', 'localtime') as endTime,
    COUNT(sd.id) as dataCount
FROM Sessions s
LEFT JOIN SensorData sd ON s.sessionId = sd.sessionId
GROUP BY s.sessionId
ORDER BY s.startTime DESC;
*/
