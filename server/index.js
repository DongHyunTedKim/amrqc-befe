const os = require("os");
const winston = require("winston");
const express = require("express");
const cors = require("cors");
const DatabaseManager = require("./db");
const WebSocketServer = require("./websocketServer");
const serverInfoRoutes = require("./routes/serverInfo");
const sensorDataRoutes = require("./routes/sensorData");
const mockDataRoutes = require("./routes/mockData");

// 로거 설정
const logger = winston.createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
      }`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: "server.log",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

/**
 * AMR QC 솔루션 서버
 * - WebSocket 서버 (포트 8001)
 * - REST API 서버 (포트 8000)
 * - SQLite 데이터베이스 (data.db)
 * - 센서 데이터 실시간 수집 및 저장
 */
class AMRQCServer {
  constructor(options = {}) {
    this.config = {
      wsPort: options.wsPort || 8001,
      httpPort: options.httpPort || 8000,
      dbPath: options.dbPath || "./data.db",
      queue: {
        maxBatchSize: options.maxBatchSize || 1000,
        flushInterval: options.flushInterval || 5000,
      },
    };

    this.db = null;
    this.wsServer = null;
    this.httpServer = null;
    this.app = null;
    this.startTime = Date.now();
  }

  async start() {
    try {
      logger.info("🚀 Starting AMR QC Server...");
      logger.info(`📊 Configuration:`, this.config);

      // 데이터베이스 초기화
      logger.info("📀 Initializing database...");
      this.db = new DatabaseManager(this.config.dbPath);

      // Express 앱 초기화
      logger.info("🌐 Starting Express server...");
      this.initializeExpress();

      // Express 서버 시작
      this.httpServer = this.app.listen(this.config.httpPort, () => {
        logger.info(
          `✅ Express server listening on port ${this.config.httpPort}`
        );
      });

      // WebSocket 서버 시작
      logger.info("🌐 Starting WebSocket server...");
      this.wsServer = new WebSocketServer(this.config.wsPort, this.db, {
        queue: this.config.queue,
      });

      // 로컬 IP 주소 출력
      this.displayServerInfo();

      // 주기적 상태 리포트
      this.startStatusReporting();

      logger.info("✅ AMR QC Server started successfully!");
    } catch (error) {
      logger.error("❌ Failed to start server:", error);
      process.exit(1);
    }
  }

  initializeExpress() {
    this.app = express();

    // CORS 설정
    this.app.use(cors());

    // JSON 파싱 미들웨어
    this.app.use(express.json());

    // 서버 인스턴스를 app.locals에 저장
    this.app.locals.amrServer = this;

    // API 라우트 설정
    this.app.use("/api/server", serverInfoRoutes);
    this.app.use("/api/data", sensorDataRoutes);
    this.app.use("/api/mock", mockDataRoutes);

    // 404 핸들러
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Cannot ${req.method} ${req.url}`,
      });
    });

    // 에러 핸들러
    this.app.use((err, req, res, next) => {
      logger.error("Express error:", err);
      res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: err.message,
      });
    });
  }

  displayServerInfo() {
    const interfaces = os.networkInterfaces();
    const localIPs = [];

    // 로컬 IP 주소들 수집
    for (const interfaceName in interfaces) {
      const interfaceInfo = interfaces[interfaceName];
      for (const info of interfaceInfo) {
        if (info.family === "IPv4" && !info.internal) {
          localIPs.push(info.address);
        }
      }
    }

    logger.info("🔗 Server Connection URLs:");
    localIPs.forEach((ip) => {
      logger.info(`   HTTP API: http://${ip}:${this.config.httpPort}`);
      logger.info(`   WebSocket: ws://${ip}:${this.config.wsPort}`);
    });

    if (localIPs.length === 0) {
      logger.warn("⚠️  No external network interfaces found");
      logger.info(
        `   Local HTTP API: http://localhost:${this.config.httpPort}`
      );
      logger.info(`   Local WebSocket: ws://localhost:${this.config.wsPort}`);
    }
  }

  startStatusReporting() {
    // 1분마다 서버 상태 리포트
    setInterval(() => {
      const stats = this.wsServer.getStats();
      const uptime = Math.floor((Date.now() - this.startTime) / 1000);

      logger.info("📊 Server Status Report:", {
        uptime: `${uptime}s`,
        connections: stats.server.currentConnections,
        totalMessages: stats.server.messagesReceived,
        queueSize: stats.queue.currentQueueSize,
        lossRate: `${stats.queue.lossRate}%`,
        batchCount: stats.queue.batchCount,
      });

      // 높은 유실률 경고
      if (parseFloat(stats.queue.lossRate) > 0.5) {
        logger.warn("⚠️  High packet loss rate detected!", {
          lossRate: `${stats.queue.lossRate}%`,
          recommendation:
            "Consider increasing batch size or reducing flush interval",
        });
      }
    }, 60000); // 1분
  }

  async shutdown() {
    logger.info("🛑 Shutting down AMR QC Server...");

    try {
      // Express 서버 종료
      if (this.httpServer) {
        await new Promise((resolve) => {
          this.httpServer.close(resolve);
        });
        logger.info("✅ Express server stopped");
      }

      // WebSocket 서버 종료
      if (this.wsServer) {
        this.wsServer.shutdown();
      }

      // 데이터베이스 연결 종료
      if (this.db) {
        this.db.close();
      }

      logger.info("✅ Server shutdown completed");
      process.exit(0);
    } catch (error) {
      logger.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  }

  // 서버 통계 조회 (외부 API용)
  getStats() {
    if (!this.wsServer) {
      return { error: "Server not started" };
    }

    const stats = this.wsServer.getStats();
    const uptime = Date.now() - this.startTime;

    return {
      uptime: uptime,
      startTime: this.startTime,
      config: this.config,
      ...stats,
    };
  }
}

// 개발 환경에서 직접 실행
if (require.main === module) {
  const server = new AMRQCServer({
    wsPort: process.env.WS_PORT || 8001,
    httpPort: process.env.HTTP_PORT || 8000,
    dbPath: process.env.DB_PATH || "./data.db",
    maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE) || 1000,
    flushInterval: parseInt(process.env.FLUSH_INTERVAL) || 5000,
  });

  // Graceful shutdown 처리
  process.on("SIGTERM", () => server.shutdown());
  process.on("SIGINT", () => server.shutdown());

  // 에러 처리
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught Exception:", error);
    server.shutdown();
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Rejection at:", promise, "reason:", reason);
    server.shutdown();
  });

  // 서버 시작
  server.start();
}

module.exports = AMRQCServer;
