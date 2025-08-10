# 📌 AMR QC 센서 모니터링 - MVP 구현 가이드

## 🎯 MVP 핵심 기능

### 유저 저니 (단순화)

```
1. 앱 실행 → WebSocket 연결 → device_register
2. 서버: device_registered 응답
3. START 버튼 → session_start 메시지
4. 서버: session_created (sessionId 발급)
5. 센서 데이터 전송 (sessionId 포함)
6. STOP 버튼 → session_end 메시지
7. 서버: session_ended 응답 (선택적)
```

## 🔑 서버 필수 구현 사항

### 1. 메시지 처리

#### 필수 지원 메시지

- ✅ `device_register` → `device_registered`
- ✅ `session_start` → `session_created`
- ✅ `session_end` → `session_ended` (선택적)
- ✅ `sensor_data` → 저장

#### MVP에서 생략 가능

- ❌ `ping` (클라이언트가 알아서 재연결)
- ❌ `error` 복잡한 처리 (기본 에러만)
- ❌ `force_disconnect` (MVP에서 불필요)

### 2. 상태 관리

```javascript
// 최소 상태 관리
const devices = {
  AMR_001: {
    isConnected: true,
    activeSessionId: "session_123", // null 가능
  },
};
```

## 📊 데이터베이스 구조

### 센서 데이터 테이블

```sql
CREATE TABLE sensor_data (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  session_id VARCHAR(100),  -- null 가능 (호환성)
  sensor_type VARCHAR(20) NOT NULL,
  timestamp BIGINT NOT NULL,
  value JSONB NOT NULL,

  INDEX idx_session (session_id, timestamp)
);
```

### 세션 테이블 (선택적)

```sql
CREATE TABLE sessions (
  session_id VARCHAR(100) PRIMARY KEY,
  device_id VARCHAR(50) NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT,
  status VARCHAR(20) DEFAULT 'active'
);
```

## ⚠️ 필수 예외 처리

### 1. 연결 끊김 시

```javascript
onWebSocketClose(deviceId) {
  // 활성 세션이 있으면 'aborted'로 마킹
  const session = getActiveSession(deviceId);
  if (session) {
    endSession(session.sessionId, 'aborted');
  }
}
```

### 2. 중복 세션 시작

```javascript
onSessionStart(deviceId) {
  // 기존 세션 자동 종료 후 새 세션 시작
  const existingSession = getActiveSession(deviceId);
  if (existingSession) {
    endSession(existingSession.sessionId, 'replaced');
  }
  return createNewSession(deviceId);
}
```

### 3. sessionId 없는 데이터

```javascript
onSensorData(data) {
  if (!data.sessionId) {
    // MVP: 그냥 저장 (session_id null)
    saveSensorData(data);
  }
}
```

## 🚀 MVP 구현 순서

1. **1단계**: 기본 WebSocket 연결 + device_register
2. **2단계**: session_start/end 메시지 처리
3. **3단계**: sensor_data 저장
4. **4단계**: 기본 웹뷰어 (세션별 데이터 조회)

## 💬 클라이언트 특징

**클라이언트는 이미 모든 고급 기능을 지원합니다:**

- ✅ 자동 재연결 (서버 지원 불필요)
- ✅ 오프라인 저장 (서버 지원 불필요)
- ✅ 하트비트 (서버 지원 불필요)
- ✅ 네트워크 모니터링 (서버 지원 불필요)

**따라서 서버는 핵심 기능만 구현하면 됩니다!**

---

_MVP 구현 후 필요에 따라 고급 기능 추가 검토_
