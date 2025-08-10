# 📋 AMR QC 센서 모니터링 앱 - WebSocket API 업데이트 요청

## 🎯 변경 배경

현재 START/STOP 버튼을 누를 때마다 WebSocket 연결을 완전히 끊었다가 다시 연결하는 방식은 비효율적입니다.
세션 관리만으로 충분하므로, WebSocket 연결은 유지하면서 세션만 시작/종료하는 방식으로 개선했습니다.

## 📊 성능 개선 효과

- **이전**: START 버튼 클릭 시 3-5초 대기 (WebSocket 재연결 + Device 등록)
- **개선**: START 버튼 클릭 시 0.1-0.3초 (세션 시작 메시지만 전송)
- **서버 부하 감소**: TCP 핸드셰이크 오버헤드 제거

## 🔄 새로운 메시지 타입 추가 요청

### 1. 클라이언트 → 서버 메시지

#### `session_start` - 새로운 세션 시작 요청

```json
{
  "type": "session_start",
  "deviceId": "AMR_001",
  "timestamp": 1703123456789
}
```

- **설명**: 새로운 데이터 수집 세션을 시작합니다
- **언제 전송**: START 버튼 클릭 시
- **기대 응답**: `session_created` 메시지

#### `session_end` - 현재 세션 종료

```json
{
  "type": "session_end",
  "deviceId": "AMR_001",
  "sessionId": "session_abc123",
  "timestamp": 1703123456789
}
```

- **설명**: 현재 진행 중인 세션을 종료합니다
- **언제 전송**: STOP 버튼 클릭 시
- **기대 응답**: `session_ended` 메시지 또는 ACK

### 2. 서버 → 클라이언트 메시지

#### `session_created` - 세션 생성 완료

```json
{
  "type": "session_created",
  "sessionId": "session_def456",
  "deviceId": "AMR_001",
  "timestamp": 1703123456789
}
```

- **설명**: 새로운 세션이 성공적으로 생성되었음을 알림
- **포함 정보**: 새로 발급된 sessionId
- **클라이언트 동작**: 이후 센서 데이터에 이 sessionId를 포함하여 전송

#### `session_ended` - 세션 종료 확인 (선택적)

```json
{
  "type": "session_ended",
  "sessionId": "session_abc123",
  "deviceId": "AMR_001",
  "timestamp": 1703123456789
}
```

- **설명**: 세션이 정상적으로 종료되었음을 확인
- **클라이언트 동작**: sessionId를 null로 초기화

## 🔧 서버 구현 가이드

### 세션 관리 로직

```python
# 예시 구현 (Python)
class SessionManager:
    def handle_session_start(self, device_id, timestamp):
        # 1. 새로운 세션 ID 생성
        session_id = f"session_{uuid.uuid4().hex[:12]}"

        # 2. 이전 세션이 있다면 자동 종료 처리
        if device_id in self.active_sessions:
            self.end_session(self.active_sessions[device_id])

        # 3. 새 세션 등록
        self.active_sessions[device_id] = session_id
        self.session_data[session_id] = {
            'device_id': device_id,
            'start_time': timestamp,
            'data_count': 0
        }

        # 4. 클라이언트에 응답
        return {
            'type': 'session_created',
            'sessionId': session_id,
            'deviceId': device_id,
            'timestamp': timestamp
        }

    def handle_session_end(self, device_id, session_id, timestamp):
        # 1. 세션 종료 처리
        if session_id in self.session_data:
            self.session_data[session_id]['end_time'] = timestamp
            self.session_data[session_id]['status'] = 'completed'

        # 2. 활성 세션에서 제거
        if device_id in self.active_sessions:
            del self.active_sessions[device_id]

        # 3. 클라이언트에 응답 (선택적)
        return {
            'type': 'session_ended',
            'sessionId': session_id,
            'deviceId': device_id,
            'timestamp': timestamp
        }
```

### 중요 고려사항

1. **하위 호환성 유지**

   - 기존 `device_register` → `device_registered` 플로우는 그대로 유지
   - `device_registered` 응답에 sessionId를 포함하더라도 신버전 클라이언트는 무시
   - 구버전 클라이언트는 여전히 disconnect/reconnect 방식 사용 가능

2. **세션 중복 방지**

   - 같은 deviceId로 새 세션 시작 시, 이전 세션 자동 종료
   - 활성 세션이 없는 상태에서 센서 데이터 수신 시 처리 방안 필요

3. **타임아웃 처리**

   - 세션이 열린 상태로 장시간 데이터가 없으면 자동 종료 고려
   - 권장: 30분 이상 데이터 없으면 세션 자동 종료

4. **에러 처리**
   ```json
   {
     "type": "error",
     "errorCode": "SESSION_ALREADY_ACTIVE",
     "message": "Device already has an active session",
     "deviceId": "AMR_001"
   }
   ```

## 📈 예상 시나리오

### 정상 플로우

```
1. 클라이언트: WebSocket 연결 → device_register
2. 서버: device_registered (sessionId 포함하지 않음)
3. 클라이언트: START 버튼 → session_start
4. 서버: session_created (새로운 sessionId)
5. 클라이언트: 센서 데이터 전송 (sessionId 포함)
6. 클라이언트: STOP 버튼 → session_end
7. 서버: session_ended 또는 ACK
8. 클라이언트: START 버튼 → session_start (WebSocket 연결 유지)
9. 서버: session_created (또 다른 새로운 sessionId)
```

### 비정상 종료 처리

- 클라이언트가 session_end 없이 연결이 끊어진 경우
- 서버는 WebSocket 연결 종료 감지 시 활성 세션 자동 종료

## 🤝 협의 필요 사항

1. **session_ended 응답 필요 여부**

   - 필수 아님, ACK로 대체 가능
   - 클라이언트는 session_end 전송 후 즉시 sessionId를 null로 처리

2. **세션 ID 형식**

   - 제안: `session_{timestamp}_{random}` 또는 UUID
   - 서버 측 자유롭게 결정

3. **기존 클라이언트 호환성**

   - 새 메시지 타입을 지원하지 않는 클라이언트는 기존 방식 유지
   - 서버는 두 방식 모두 지원 필요

4. **⚠️ 중요: device_registered 응답 변경**
   - 신버전 클라이언트는 `device_registered`에서 받은 sessionId를 **무시**합니다
   - 세션은 오직 `session_start` → `session_created` 플로우로만 시작됩니다
   - 서버가 device_registered에 sessionId를 포함해도 클라이언트는 사용하지 않습니다

## 📝 테스트 체크리스트

- [ ] session_start 메시지 수신 및 session_created 응답
- [ ] 동일 device로 연속 session_start 시 이전 세션 자동 종료
- [ ] session_end 메시지 수신 및 처리
- [ ] sessionId별로 센서 데이터 정확히 구분 저장
- [ ] WebSocket 연결 유지 상태에서 여러 세션 생성/종료
- [ ] 비정상 종료 시 세션 정리

## 💬 문의사항

구현 중 궁금한 점이나 제안사항이 있으시면 언제든 연락 주세요!

---

_작성일: 2024년 12월_
_클라이언트 버전: 1.1.0 (세션 관리 개선)_
