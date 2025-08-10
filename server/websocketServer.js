const WebSocket = require("ws");
const winston = require("winston");
const DataQueue = require("./dataQueue");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()],
});

/**
 * WebSocket 서버 클래스
 * - 스마트폰에서 전송된 센서 패킷 실시간 수신
 * - ping/pong 연결 상태 관리
 * - 패킷 유실률 < 0.5% 목표
 */
class WebSocketServer {
  constructor(port, databaseManager, options = {}) {
    this.port = port;
    this.db = databaseManager;
    this.dataQueue = new DataQueue(databaseManager, options.queue);

    // 연결 관리
    this.clients = new Map();
    this.connectionCount = 0;

    // 통계
    this.stats = {
      totalConnections: 0,
      currentConnections: 0,
      messagesReceived: 0,
      messagesProcessed: 0,
      messagesFailed: 0,
    };

    // 강제 해제 후 일정 시간 재접속 차단 관리 (기본 5초, ENV로 조정 가능)
    this.blockedDevices = new Map(); // deviceId -> unblockTimestamp(ms)
    const envBlock = parseInt(process.env.BLOCK_DURATION_MS || "", 10);
    this.blockDurationMs =
      Number.isFinite(envBlock) && envBlock > 0
        ? envBlock
        : options.blockDurationMs ?? 5_000; // 기본 5초

    // WebSocket 서버 생성
    this.wss = new WebSocket.Server({
      port: this.port,
      perMessageDeflate: false, // 압축 비활성화 (성능 우선)
    });

    this.setupEventHandlers();
    this.startHealthCheck();

    logger.info(`WebSocket server started on port ${this.port}`);
  }

  setupEventHandlers() {
    this.wss.on("connection", (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on("error", (error) => {
      logger.error("WebSocket server error:", error);
    });

    // Graceful shutdown 처리
    process.on("SIGTERM", () => {
      this.shutdown();
    });

    process.on("SIGINT", () => {
      this.shutdown();
    });
  }

  handleConnection(ws, request) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws: ws,
      connectedAt: Date.now(),
      lastPong: Date.now(),
      deviceId: null, // 첫 메시지에서 설정됨
      sessionId: null, // 세션 ID (디바이스 등록 시 생성)
      messageCount: 0,
    };

    this.clients.set(clientId, clientInfo);
    this.stats.totalConnections++;
    this.stats.currentConnections++;

    logger.info(
      `📱 Client connected: ${clientId} from ${request.socket.remoteAddress} - Waiting for device registration...`
    );

    // 연결 이벤트 핸들러
    ws.on("message", (data) => {
      this.handleMessage(clientId, data);
    });

    ws.on("close", (code, reason) => {
      this.handleDisconnection(clientId, code, reason);
    });

    ws.on("error", (error) => {
      logger.error(`Client ${clientId} error:`, error);
      this.handleDisconnection(clientId, 1006, "Error");
    });

    ws.on("pong", () => {
      if (this.clients.has(clientId)) {
        this.clients.get(clientId).lastPong = Date.now();
      }
    });

    // 초기 환영 메시지 전송
    this.sendMessage(ws, {
      type: "welcome",
      clientId: clientId,
      timestamp: Date.now(),
      message:
        "Connection established. Please send device_register message to identify your device.",
    });
  }

  handleMessage(clientId, data) {
    try {
      this.stats.messagesReceived++;

      const client = this.clients.get(clientId);
      if (!client) {
        logger.warn(`Message from unknown client: ${clientId}`);
        return;
      }

      client.messageCount++;
      client.lastMessageAt = Date.now();

      // 메시지 파싱
      let message;
      try {
        message = JSON.parse(data.toString());
      } catch (parseError) {
        logger.warn(
          `Invalid JSON from client ${clientId}:`,
          parseError.message
        );
        this.sendError(client.ws, "INVALID_JSON", "Message must be valid JSON");
        this.stats.messagesFailed++;
        return;
      }

      // 메시지 타입 처리
      switch (message.type) {
        case "sensor_data":
          this.handleSensorData(client, message);
          break;

        case "device_register":
          this.handleDeviceRegister(client, message);
          break;

        case "session_start":
          this.handleSessionStart(client, message);
          break;

        case "session_end":
          this.handleSessionEnd(client, message);
          break;

        case "device_unregister":
        case "device_disconnect":
          this.handleDeviceUnregister(client, message);
          break;

        case "ping":
          this.handlePing(client, message);
          break;

        default:
          logger.warn(
            `Unknown message type from client ${clientId}:`,
            message.type
          );
          this.sendError(
            client.ws,
            "UNKNOWN_TYPE",
            `Unknown message type: ${message.type}`
          );
          this.stats.messagesFailed++;
      }
    } catch (error) {
      logger.error(`Message handling error for client ${clientId}:`, error);
      this.stats.messagesFailed++;
    }
  }

  handleSensorData(client, message) {
    try {
      const sensorData = {
        deviceId: client.deviceId || message.deviceId,
        timestamp: message.timestamp || Date.now(),
        sensorType: message.sensorType,
        value: message.value,
        sessionId: client.sessionId || message.sessionId,
      };

      // 차단된 디바이스인지 선확인
      if (sensorData.deviceId && this.isDeviceBlocked(sensorData.deviceId)) {
        this.sendError(
          client.ws,
          "DEVICE_BLOCKED",
          "This device is temporarily blocked by administrator"
        );
        try {
          client.ws.close(4001, "Temporarily blocked by administrator");
        } catch (_) {}
        return;
      }

      // 디바이스 ID 설정 (첫 메시지에서)
      if (!client.deviceId && message.deviceId) {
        client.deviceId = message.deviceId;
        logger.info(
          `Device ID set from sensor data for client ${client.id}: ${message.deviceId}`
        );

        // 하위 호환성: 구버전 클라이언트는 세션 없이도 데이터 전송 가능
        // 신버전 클라이언트는 session_start를 사용해야 함
        if (!client.sessionId && !message.sessionId) {
          logger.warn(
            `Sensor data received without session from device ${message.deviceId}. Consider using session_start for better data organization.`
          );
        }
      }

      // 데이터 큐에 추가
      const success = this.dataQueue.enqueue(sensorData);

      if (success) {
        this.stats.messagesProcessed++;

        // ACK 응답 전송
        this.sendMessage(client.ws, {
          type: "ack",
          timestamp: Date.now(),
          success: true,
        });

        // 다른 클라이언트들에게 센서 데이터 브로드캐스트
        this.broadcastSensorData(sensorData, client.id);
      } else {
        this.stats.messagesFailed++;

        // 검증 실패 응답
        this.sendError(
          client.ws,
          "VALIDATION_FAILED",
          "Invalid sensor data format"
        );
      }
    } catch (error) {
      logger.error(`Sensor data processing error:`, error);
      this.stats.messagesFailed++;
      this.sendError(
        client.ws,
        "PROCESSING_ERROR",
        "Failed to process sensor data"
      );
    }
  }

  handleDeviceRegister(client, message) {
    if (message.deviceId && typeof message.deviceId === "string") {
      // 차단된 디바이스는 등록 거부
      if (this.isDeviceBlocked(message.deviceId)) {
        this.sendError(
          client.ws,
          "DEVICE_BLOCKED",
          "This device is temporarily blocked by administrator"
        );
        try {
          client.ws.close(4001, "Temporarily blocked by administrator");
        } catch (_) {}
        return;
      }

      client.deviceId = message.deviceId;

      logger.info(
        `✅ Device registered: ${message.deviceId} for client ${client.id}`
      );

      // sessionId를 포함하지 않음 (신버전 클라이언트는 무시함)
      this.sendMessage(client.ws, {
        type: "device_registered",
        deviceId: message.deviceId,
        timestamp: Date.now(),
      });
    } else {
      logger.warn(
        `❌ Invalid device registration attempt from client ${
          client.id
        }: ${JSON.stringify(message)}`
      );
      this.sendError(
        client.ws,
        "INVALID_DEVICE_ID",
        "Device ID must be a non-empty string"
      );
    }
  }

  handleSessionStart(client, message) {
    try {
      const deviceId = message.deviceId || client.deviceId;

      if (!deviceId) {
        this.sendError(
          client.ws,
          "NO_DEVICE_ID",
          "Device must be registered before starting a session"
        );
        return;
      }

      // 차단된 디바이스 확인
      if (this.isDeviceBlocked(deviceId)) {
        this.sendError(
          client.ws,
          "DEVICE_BLOCKED",
          "This device is temporarily blocked by administrator"
        );
        return;
      }

      // 기존 활성 세션이 있으면 종료
      const activeSession = this.db.statements.getActiveSession?.get(deviceId);
      if (activeSession) {
        logger.info(
          `🔄 Ending existing session ${activeSession.sessionId} for device ${deviceId} (replaced)`
        );
        // 세션을 'replaced' 상태로 변경
        this.db.db
          .prepare(
            "UPDATE Sessions SET endTime = ?, status = 'replaced', updatedAt = ? WHERE sessionId = ?"
          )
          .run(Date.now(), Date.now(), activeSession.sessionId);
      }

      // 새 세션 생성
      const sessionResult = this.db.createSession(
        deviceId,
        `Session started via WebSocket by client ${client.id}`
      );

      if (sessionResult.success) {
        client.sessionId = sessionResult.sessionId;

        logger.info(
          `🟢 Session started: ${sessionResult.sessionId} for device ${deviceId}`
        );

        // session_created 응답 전송
        this.sendMessage(client.ws, {
          type: "session_created",
          sessionId: sessionResult.sessionId,
          deviceId: deviceId,
          timestamp: Date.now(),
        });
      } else {
        logger.error(
          `Failed to create session for device ${deviceId}:`,
          sessionResult.error
        );
        this.sendError(
          client.ws,
          "SESSION_CREATION_FAILED",
          "Failed to create new session"
        );
      }
    } catch (error) {
      logger.error("Session start handling failed:", error);
      this.sendError(
        client.ws,
        "SESSION_START_ERROR",
        "Failed to start session"
      );
    }
  }

  handleSessionEnd(client, message) {
    try {
      const deviceId = message.deviceId || client.deviceId;
      const sessionId = message.sessionId || client.sessionId;

      if (!sessionId) {
        this.sendError(client.ws, "NO_SESSION_ID", "No active session to end");
        return;
      }

      // 세션 종료
      const result = this.db.endSession(sessionId);

      if (result.success) {
        client.sessionId = null;

        logger.info(`🔴 Session ended: ${sessionId} for device ${deviceId}`);

        // session_ended 응답 전송 (선택적)
        this.sendMessage(client.ws, {
          type: "session_ended",
          sessionId: sessionId,
          deviceId: deviceId,
          timestamp: Date.now(),
        });
      } else {
        logger.error(`Failed to end session ${sessionId}:`, result.error);
        this.sendError(
          client.ws,
          "SESSION_END_FAILED",
          "Failed to end session"
        );
      }
    } catch (error) {
      logger.error("Session end handling failed:", error);
      this.sendError(client.ws, "SESSION_END_ERROR", "Failed to end session");
    }
  }

  handlePing(client, message) {
    this.sendMessage(client.ws, {
      type: "pong",
      timestamp: Date.now(),
      originalTimestamp: message.timestamp,
    });
  }

  handleDeviceUnregister(client, message) {
    try {
      const deviceId = message.deviceId || client.deviceId;
      logger.info(
        `📴 Device unregister requested: ${deviceId || "unknown"} (client ${
          client.id
        })`
      );

      // 확인 응답
      this.sendMessage(client.ws, {
        type: "device_unregistered",
        deviceId,
        timestamp: Date.now(),
      });

      // 정상 종료
      try {
        client.ws.close(1000, "Client requested disconnect");
      } catch (_) {}
    } catch (error) {
      logger.error("Device unregister handling failed:", error);
      this.sendError(
        client.ws,
        "UNREGISTER_FAILED",
        "Failed to unregister device"
      );
    }
  }

  handleDisconnection(clientId, code, reason) {
    const client = this.clients.get(clientId);
    if (client) {
      const duration = Date.now() - client.connectedAt;

      // 세션 종료 처리
      if (client.sessionId) {
        if (code === 1000 || code === 1001) {
          // 정상 종료
          this.db.endSession(client.sessionId);
          logger.info(
            `Session ${client.sessionId} ended normally for device ${client.deviceId}`
          );
        } else {
          // 비정상 종료 - 세션을 'aborted' 상태로 변경
          try {
            this.db.db
              .prepare(
                "UPDATE Sessions SET endTime = ?, status = 'aborted', updatedAt = ? WHERE sessionId = ?"
              )
              .run(Date.now(), Date.now(), client.sessionId);
            logger.warn(
              `Session ${client.sessionId} aborted for device ${client.deviceId} (code: ${code})`
            );
          } catch (error) {
            logger.error(`Failed to mark session as aborted:`, error);
          }
        }
      }

      logger.info(
        `Client disconnected: ${clientId} (${
          client.deviceId || "unregistered"
        }) after ${duration}ms, ${client.messageCount} messages, code: ${code}`
      );

      this.clients.delete(clientId);
      this.stats.currentConnections--;
    }
  }

  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        logger.error("Failed to send message:", error);
      }
    }
  }

  sendError(ws, errorCode, errorMessage) {
    this.sendMessage(ws, {
      type: "error",
      errorCode: errorCode,
      errorMessage: errorMessage,
      timestamp: Date.now(),
    });
  }

  generateClientId() {
    return `client_${++this.connectionCount}_${Date.now()}`;
  }

  // 연결 상태 헬스체크 (ping/pong)
  startHealthCheck() {
    setInterval(() => {
      const now = Date.now();

      this.clients.forEach((client, clientId) => {
        // 30초 이상 pong이 없는 클라이언트 체크
        if (now - client.lastPong > 30000) {
          logger.warn(
            `Client ${clientId} appears dead, terminating connection`
          );
          client.ws.terminate();
          this.clients.delete(clientId);
          this.stats.currentConnections--;
          return;
        }

        // ping 전송
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 15000); // 15초마다 체크
  }

  // 통계 조회
  getStats() {
    const queueStats = this.dataQueue.getStats();

    return {
      server: this.stats,
      queue: queueStats,
      clients: Array.from(this.clients.values()).map((client) => ({
        id: client.id,
        deviceId: client.deviceId,
        connectedAt: client.connectedAt,
        messageCount: client.messageCount,
      })),
    };
  }

  // 모든 클라이언트에게 브로드캐스트
  broadcast(message) {
    this.clients.forEach((client) => {
      this.sendMessage(client.ws, message);
    });
  }

  // 연결된 디바이스 목록 조회
  getConnectedDevices() {
    // 등록이 완료된 디바이스만 노출
    return Array.from(this.clients.values())
      .filter(
        (client) =>
          client.ws.readyState === WebSocket.OPEN &&
          typeof client.deviceId === "string" &&
          client.deviceId.trim().length > 0
      )
      .map((client) => ({
        id: client.id,
        deviceId: client.deviceId,
        connectedAt: client.connectedAt,
        messageCount: client.messageCount,
        lastActivity: client.lastPong,
        sessionId: client.sessionId,
        hasActiveSession: !!client.sessionId,
        status: "connected",
      }));
  }

  // 센서 데이터 브로드캐스트
  broadcastSensorData(sensorData, excludeClientId = null) {
    const message = {
      type: "sensor_data",
      data: sensorData,
      timestamp: Date.now(),
    };

    // 센서 데이터를 전송한 클라이언트를 제외한 모든 클라이언트에게 브로드캐스트
    this.clients.forEach((client, clientId) => {
      if (
        clientId !== excludeClientId &&
        client.ws.readyState === WebSocket.OPEN
      ) {
        this.sendMessage(client.ws, message);
      }
    });

    logger.info(
      `Broadcasted sensor data: ${sensorData.sensorType} from ${sensorData.deviceId}`
    );
  }

  // 특정 디바이스 강제 연결 해제
  disconnectDevice(deviceId) {
    const client = Array.from(this.clients.values()).find(
      (c) => c.deviceId === deviceId
    );

    if (!client) {
      logger.warn(`Device not found for disconnect: ${deviceId}`);
      return { success: false, error: "Device not found" };
    }

    if (client.ws.readyState !== WebSocket.OPEN) {
      logger.warn(`Device already disconnected: ${deviceId}`);
      return { success: false, error: "Device already disconnected" };
    }

    // 클라이언트에게 강제 연결 해제 알림 (재시도 대기시간 안내 포함)
    this.sendMessage(client.ws, {
      type: "force_disconnect",
      reason: "Disconnected by administrator",
      timestamp: Date.now(),
      retryAfterMs: this.blockDurationMs,
    });

    // 잠시 후 연결 종료 (클라이언트가 메시지를 받을 시간을 줌)
    setTimeout(() => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close(1000, "Force disconnect by administrator");
      }
    }, 100);

    // 재연결 차단 등록
    this.blockDevice(deviceId, this.blockDurationMs);
    logger.info(
      `Blocked device ${deviceId} for ${this.blockDurationMs}ms after force disconnect`
    );

    logger.info(`Force disconnected device: ${deviceId}`);
    return { success: true, message: `Device ${deviceId} disconnected` };
  }

  // 디바이스 차단/해제 유틸리티
  blockDevice(deviceId, durationMs = this.blockDurationMs) {
    const until = Date.now() + Math.max(0, durationMs);
    this.blockedDevices.set(deviceId, until);
  }

  isDeviceBlocked(deviceId) {
    const until = this.blockedDevices.get(deviceId);
    if (!until) return false;
    if (Date.now() > until) {
      this.blockedDevices.delete(deviceId);
      return false;
    }
    return true;
  }

  // 서버 종료
  shutdown() {
    logger.info("WebSocket server shutting down...");

    // 모든 클라이언트에게 종료 알림
    this.broadcast({
      type: "server_shutdown",
      timestamp: Date.now(),
    });

    // 연결 종료
    this.clients.forEach((client) => {
      client.ws.close(1001, "Server shutdown");
    });

    // 데이터 큐 정리
    this.dataQueue.destroy();

    // 서버 종료
    this.wss.close(() => {
      logger.info("WebSocket server closed");
    });
  }
}

module.exports = WebSocketServer;
