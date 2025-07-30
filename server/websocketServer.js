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
      messageCount: 0,
    };

    this.clients.set(clientId, clientInfo);
    this.stats.totalConnections++;
    this.stats.currentConnections++;

    logger.info(
      `Client connected: ${clientId} from ${request.socket.remoteAddress}`
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
      };

      // 디바이스 ID 설정 (첫 메시지에서)
      if (!client.deviceId && message.deviceId) {
        client.deviceId = message.deviceId;
        logger.info(
          `Device ID registered for client ${client.id}: ${message.deviceId}`
        );
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
      client.deviceId = message.deviceId;
      logger.info(
        `Device registered: ${message.deviceId} for client ${client.id}`
      );

      this.sendMessage(client.ws, {
        type: "device_registered",
        deviceId: message.deviceId,
        timestamp: Date.now(),
      });
    } else {
      this.sendError(
        client.ws,
        "INVALID_DEVICE_ID",
        "Device ID must be a non-empty string"
      );
    }
  }

  handlePing(client, message) {
    this.sendMessage(client.ws, {
      type: "pong",
      timestamp: Date.now(),
      originalTimestamp: message.timestamp,
    });
  }

  handleDisconnection(clientId, code, reason) {
    const client = this.clients.get(clientId);
    if (client) {
      const duration = Date.now() - client.connectedAt;
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
