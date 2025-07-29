# AMR QC 솔루션 - 데이터 플로우 설계 문서

## 1. 데이터 플로우 개요

AMR QC 솔루션의 데이터는 다음과 같은 경로로 흐릅니다:

```
스마트폰 센서 → WebSocket → Node.js 서버 → In-Memory Buffer → SQLite DB → REST API → 웹 클라이언트
```

## 2. 전체 데이터 플로우 다이어그램

```mermaid
graph TB
    subgraph "스마트폰"
        A[센서 데이터 수집]
        B[JSON 패킷 생성]
    end

    subgraph "Node.js 서버"
        C[WebSocket 서버]
        D[데이터 검증]
        E[In-Memory Buffer]
        F[배치 처리기]
        G[SQLite Writer]
        H[REST API]
    end

    subgraph "데이터베이스"
        I[(SQLite DB)]
    end

    subgraph "웹 클라이언트"
        J[타임라인 뷰]
        K[실시간 모니터링]
        L[데이터 다운로드]
    end

    A --> B
    B -->|WebSocket| C
    C --> D
    D -->|유효| E
    D -->|무효| M[에러 응답]
    E --> F
    F -->|배치 INSERT| G
    G --> I

    J -->|REST 조회| H
    K -->|WebSocket 구독| C
    L -->|REST 다운로드| H
    H -->|쿼리| I
```

## 3. 단계별 상세 시나리오

### 3.1 데이터 수집 단계 (스마트폰)

1. **센서 데이터 수집**

   - 가속도계, 자이로스코프, GPS 등 6종 센서에서 데이터 수집
   - 샘플링 주기: 센서별 10Hz ~ 100Hz

2. **JSON 패킷 생성**
   ```json
   {
     "deviceId": "AMR-001",
     "sensorType": "accelerometer",
     "timestamp": 1640995200000,
     "value": {
       "x": 0.98,
       "y": -0.15,
       "z": 9.81
     }
   }
   ```

### 3.2 데이터 전송 단계 (WebSocket)

```mermaid
sequenceDiagram
    participant S as 스마트폰
    participant W as WebSocket 서버
    participant V as Validator
    participant B as Buffer

    S->>W: 연결 요청
    W->>S: 연결 승인

    loop 센서 데이터 스트리밍
        S->>W: 센서 데이터 전송
        W->>V: 데이터 검증 요청
        alt 데이터 유효
            V->>B: 버퍼에 저장
            B->>W: 저장 완료
            W->>S: ACK 응답
        else 데이터 무효
            V->>W: 검증 실패
            W->>S: 에러 응답
        end
    end

    S->>W: 연결 종료
```

### 3.3 데이터 저장 단계 (배치 처리)

1. **In-Memory Buffer 관리**

   - 버퍼 크기: 최대 1000개 레코드 또는 5초
   - 버퍼 플러시 조건:
     - 1000개 레코드 도달
     - 5초 경과
     - 수동 플러시 요청

2. **배치 INSERT 프로세스**
   ```javascript
   // 의사 코드
   async function flushBuffer() {
     const batch = buffer.drain();
     const transaction = db.transaction(() => {
       for (const data of batch) {
         insertStatement.run(data);
       }
     });
     transaction();
   }
   ```

### 3.4 데이터 조회 단계 (REST API)

```mermaid
graph LR
    A[클라이언트 요청] --> B{요청 타입}
    B -->|실시간 조회| C[GET /data]
    B -->|다운로드| D[GET /data/download]

    C --> E[시간 범위 쿼리]
    D --> F[CSV 생성]

    E --> G[(SQLite)]
    F --> G

    G --> H[응답 포맷팅]
    H --> I[클라이언트 응답]
```

## 4. 센서 타입별 처리 분기

```mermaid
graph TD
    A[센서 데이터 수신] --> B{센서 타입 확인}

    B -->|accelerometer| C[3축 가속도 처리]
    B -->|gyroscope| D[3축 각속도 처리]
    B -->|gps| E[위치 정보 처리]
    B -->|temperature| F[온도 데이터 처리]
    B -->|battery| G[배터리 상태 처리]
    B -->|magnetometer| H[지자기 데이터 처리]

    C --> I[공통 저장 로직]
    D --> I
    E --> J[위치 유효성 검증]
    F --> I
    G --> I
    H --> I

    J --> I
    I --> K[(데이터베이스)]
```

### 4.1 센서별 검증 규칙

| 센서 타입     | 검증 규칙                    | 단위    |
| ------------- | ---------------------------- | ------- |
| accelerometer | x, y, z 필수, 숫자 타입      | m/s²    |
| gyroscope     | x, y, z 필수, 숫자 타입      | rad/s   |
| gps           | 위도(-90~90), 경도(-180~180) | degrees |
| temperature   | 절대영도 이상(-273.15°C)     | °C      |
| battery       | 레벨(0-100), 충전상태        | %       |
| magnetometer  | x, y, z 필수, 숫자 타입      | μT      |

## 5. 오류 처리 흐름

```mermaid
graph TB
    A[데이터 수신] --> B{검증}
    B -->|실패| C[에러 로깅]
    C --> D[에러 응답]
    D --> E[재전송 요청]

    B -->|성공| F[정상 처리]

    subgraph "에러 유형"
        G[형식 오류]
        H[범위 초과]
        I[필수값 누락]
        J[타임스탬프 오류]
    end

    subgraph "복구 전략"
        K[재시도 3회]
        L[데이터 스킵]
        M[연결 재설정]
        N[알림 발송]
    end

    C --> G
    C --> H
    C --> I
    C --> J

    E --> K
    K -->|실패| L
    L --> M
    M -->|실패| N
```

### 5.1 에러 처리 시나리오

1. **WebSocket 연결 오류**

   - 자동 재연결 (최대 3회)
   - 지수 백오프: 1초, 2초, 4초

2. **데이터 검증 오류**

   - 에러 로그 기록
   - 클라이언트에 에러 코드 전송
   - 데이터 스킵 또는 기본값 사용

3. **DB 쓰기 오류**

   - 트랜잭션 롤백
   - 버퍼에 데이터 보관
   - 다음 배치에서 재시도

4. **버퍼 오버플로우**
   - 오래된 데이터부터 제거 (FIFO)
   - 경고 로그 생성
   - 모니터링 알림

## 6. 성능 최적화 전략

### 6.1 배치 처리 최적화

```mermaid
graph LR
    A[개별 INSERT] -->|최적화| B[배치 INSERT]

    subgraph "Before"
        C[INSERT 1]
        D[INSERT 2]
        E[INSERT 3]
        F[...]
    end

    subgraph "After"
        G[BEGIN TRANSACTION]
        H[INSERT x 1000]
        I[COMMIT]
    end

    C --> G
    D --> G
    E --> G
    F --> H
    H --> I
```

### 6.2 메모리 버퍼 관리

- **버퍼 크기**: 동적 조정 (100 ~ 1000 레코드)
- **플러시 전략**:
  - 시간 기반: 5초마다
  - 크기 기반: 1000개 도달 시
  - 우선순위: 중요 데이터 즉시 플러시

### 6.3 인덱스 전략

```sql
-- 주요 쿼리 패턴에 따른 인덱스
CREATE INDEX idx_sensor_device_time ON SensorData(deviceId, timestamp);
CREATE INDEX idx_sensor_type_time ON SensorData(sensorType, timestamp);
```

## 7. 데이터 플로우 메트릭

### 7.1 모니터링 지표

| 지표           | 목표값  | 측정 방법       |
| -------------- | ------- | --------------- |
| 패킷 수신률    | > 99.5% | 수신/전송 비율  |
| 평균 지연시간  | < 100ms | 타임스탬프 차이 |
| 배치 처리 시간 | < 50ms  | 트랜잭션 시간   |
| 버퍼 사용률    | < 80%   | 현재/최대 크기  |

### 7.2 데이터 처리량

```mermaid
graph TD
    A[입력 처리량] --> B[초당 1000 패킷]
    B --> C[배치 크기 1000]
    C --> D[5초마다 플러시]
    D --> E[DB 쓰기 처리량]
    E --> F[초당 200 레코드]
```

## 8. 보안 고려사항

1. **데이터 검증**

   - 모든 입력 데이터 검증
   - SQL 인젝션 방지 (Prepared Statement)

2. **접근 제어**

   - 디바이스 ID 화이트리스트
   - API 요청 속도 제한

3. **데이터 무결성**
   - 트랜잭션 보장
   - 체크섬 검증

## 9. 확장성 고려사항

### 9.1 수평 확장 전략

```mermaid
graph TB
    A[로드 밸런서] --> B[서버 1]
    A --> C[서버 2]
    A --> D[서버 N]

    B --> E[공유 DB]
    C --> E
    D --> E

    E --> F[읽기 복제본]
```

### 9.2 향후 개선 사항

1. **스트림 처리**: Apache Kafka 도입 검토
2. **시계열 DB**: InfluxDB 마이그레이션 검토
3. **캐싱**: Redis 도입으로 조회 성능 향상
4. **분산 처리**: 마이크로서비스 아키텍처 전환
