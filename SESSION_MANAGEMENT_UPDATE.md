# 📋 AMR QC 센서 모니터링 - 세션 관리 기능 구현 완료

## ✅ 구현 완료 사항

### 1. WebSocket 메시지 타입 추가

#### 📥 클라이언트 → 서버

##### `session_start` - 새로운 세션 시작

```json
{
  "type": "session_start",
  "deviceId": "AMR_001",
  "timestamp": 1703123456789
}
```

- ✅ 구현 완료
- 기존 활성 세션이 있으면 자동으로 'replaced' 상태로 변경
- 새 세션 ID 발급

##### `session_end` - 현재 세션 종료

```json
{
  "type": "session_end",
  "deviceId": "AMR_001",
  "sessionId": "session_abc123",
  "timestamp": 1703123456789
}
```

- ✅ 구현 완료
- 세션을 'completed' 상태로 변경

#### 📤 서버 → 클라이언트

##### `session_created` - 세션 생성 완료

```json
{
  "type": "session_created",
  "sessionId": "session_def456",
  "deviceId": "AMR_001",
  "timestamp": 1703123456789
}
```

- ✅ 구현 완료

##### `session_ended` - 세션 종료 확인

```json
{
  "type": "session_ended",
  "sessionId": "session_abc123",
  "deviceId": "AMR_001",
  "timestamp": 1703123456789
}
```

- ✅ 구현 완료

### 2. 세션 상태 관리

#### 지원되는 세션 상태

- `active` - 활성 상태
- `completed` - 정상 종료
- `replaced` - 새 세션으로 대체됨
- `aborted` - 비정상 종료
- `error` - 오류 발생
- `paused` - 일시 중지 (향후 사용)

#### 세션 상태 전환 로직

1. **정상 플로우**: active → completed
2. **새 세션 시작**: active → replaced → (새 세션) active
3. **비정상 종료**: active → aborted
4. **오류 발생**: active → error

### 3. 하위 호환성

#### 구버전 클라이언트 지원

- ✅ `device_register` 메시지는 그대로 유지
- ✅ 세션 없이도 센서 데이터 저장 가능 (sessionId = null)
- ✅ 기존 disconnect/reconnect 방식도 동작

#### 신버전 클라이언트 동작

- ✅ `device_registered`의 sessionId 무시
- ✅ `session_start`로만 세션 시작
- ✅ WebSocket 연결 유지하며 세션만 관리

### 4. 데이터베이스 변경사항

#### Sessions 테이블 스키마 업데이트

```sql
CONSTRAINT chk_session_status CHECK (
  status IN ('active', 'completed', 'error', 'paused', 'replaced', 'aborted')
)
```

- ✅ 새로운 상태값 추가 완료

### 5. 에러 처리

#### 구현된 에러 코드

- `NO_DEVICE_ID` - 디바이스 등록 필요
- `DEVICE_BLOCKED` - 차단된 디바이스
- `SESSION_CREATION_FAILED` - 세션 생성 실패
- `SESSION_START_ERROR` - 세션 시작 오류
- `NO_SESSION_ID` - 활성 세션 없음
- `SESSION_END_FAILED` - 세션 종료 실패
- `SESSION_END_ERROR` - 세션 종료 오류

## 🧪 테스트 방법

### 1. 서버 시작

```bash
# 서버 시작
npm run server

# 또는 개발 모드
npm run dev:server
```

### 2. 테스트 클라이언트 실행

```bash
# 세션 관리 테스트
node test-session-client.js
```

### 3. 테스트 시나리오

#### 시나리오 1: 정상 플로우

1. WebSocket 연결
2. device_register
3. session_start → session_created 응답
4. 센서 데이터 전송 (sessionId 포함)
5. session_end → session_ended 응답

#### 시나리오 2: 세션 전환

1. 첫 번째 session_start
2. 데이터 전송
3. 두 번째 session_start (WebSocket 유지)
4. 첫 번째 세션 자동 'replaced' 처리
5. 새 sessionId로 데이터 전송

#### 시나리오 3: 비정상 종료

1. session_start
2. 데이터 전송
3. WebSocket 연결 끊김 (session_end 없이)
4. 세션 자동 'aborted' 처리

## 📊 성능 개선 효과

### 이전 방식 (disconnect/reconnect)

- START 버튼 클릭 시: **3-5초** (WebSocket 재연결 + Device 등록)
- TCP 핸드셰이크 오버헤드 발생
- 네트워크 리소스 낭비

### 개선된 방식 (세션 관리)

- START 버튼 클릭 시: **0.1-0.3초** (세션 시작 메시지만)
- WebSocket 연결 유지
- 즉각적인 응답

## 🔄 마이그레이션 가이드

### 기존 클라이언트

- **변경 불필요** - 기존 방식 그대로 동작
- 원하는 경우 점진적으로 새 API 적용

### 신규 클라이언트

1. `device_registered`의 sessionId 무시
2. START 버튼 → `session_start` 전송
3. `session_created` 응답의 sessionId 저장
4. 센서 데이터에 sessionId 포함
5. STOP 버튼 → `session_end` 전송

## 📝 주의사항

1. **세션 중복 방지**: 같은 deviceId로 여러 세션 동시 활성 불가
2. **타임아웃**: 30분 이상 데이터 없으면 세션 자동 종료 (추후 구현 예정)
3. **데이터 무결성**: 세션 전환 시 데이터 손실 없음 보장

## 🚀 다음 단계

- [ ] 세션 타임아웃 자동 처리
- [ ] 세션 일시정지/재개 기능
- [ ] 세션별 통계 API
- [ ] 세션 메타데이터 관리 개선

---

_구현 완료: 2024년 12월_
_서버 버전: 1.1.0 (세션 관리 지원)_
