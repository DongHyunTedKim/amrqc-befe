const Database = require("better-sqlite3");
const path = require("path");
const winston = require("winston");

// 로거 설정
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
    new winston.transports.File({ filename: "server.log" }),
  ],
});

class DatabaseManager {
  constructor(dbPath = "./data.db") {
    try {
      this.db = new Database(dbPath, {
        verbose: process.env.NODE_ENV === "development" ? logger.info : null,
        fileMustExist: false,
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

      logger.info("Database initialized successfully");
    } catch (error) {
      logger.error("Database initialization failed:", error);
      throw error;
    }
  }

  initSchema() {
    try {
      // 테이블 생성
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS SensorData (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          deviceId TEXT NOT NULL,
          ts INTEGER NOT NULL,
          sensorType TEXT NOT NULL,
          valueJson TEXT NOT NULL,
          createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          sessionId TEXT,
          CONSTRAINT chk_sensorType CHECK (sensorType IN ('accelerometer', 'gyroscope', 'gps', 'temperature', 'battery', 'magnetometer'))
        );
      `);

      // Sessions 테이블 생성
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS Sessions (
          sessionId TEXT PRIMARY KEY,
          deviceId TEXT NOT NULL,
          startTime INTEGER NOT NULL,
          endTime INTEGER,
          status TEXT DEFAULT 'active',
          description TEXT,
          metadata TEXT,
          createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
          CONSTRAINT chk_session_status CHECK (status IN ('active', 'completed', 'error', 'paused', 'replaced', 'aborted'))
        );
      `);

      // 인덱스 생성
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sensor_device_time ON SensorData(deviceId, ts);
        CREATE INDEX IF NOT EXISTS idx_sensor_type_time ON SensorData(sensorType, ts);
        CREATE INDEX IF NOT EXISTS idx_sensor_device_type_time ON SensorData(deviceId, sensorType, ts);
        CREATE INDEX IF NOT EXISTS idx_sensor_time ON SensorData(ts);
        CREATE INDEX IF NOT EXISTS idx_sensor_session_time ON SensorData(sessionId, ts);
        CREATE INDEX IF NOT EXISTS idx_sensor_session_type ON SensorData(sessionId, sensorType);
        CREATE INDEX IF NOT EXISTS idx_sessions_device_time ON Sessions(deviceId, startTime);
        CREATE INDEX IF NOT EXISTS idx_sessions_status ON Sessions(status);
        CREATE INDEX IF NOT EXISTS idx_sessions_device_status ON Sessions(deviceId, status);
      `);

      logger.info("Database schema initialized");
    } catch (error) {
      logger.error("Schema initialization failed:", error);
      throw error;
    }
  }

  prepareStatements() {
    try {
      // 자주 사용하는 쿼리를 미리 준비
      this.statements = {
        insertSensor: this.db.prepare(`
          INSERT INTO SensorData (deviceId, ts, sensorType, valueJson, sessionId)
          VALUES (?, ?, ?, ?, ?)
        `),

        insertSensorLegacy: this.db.prepare(`
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

        getDevices: this.db.prepare(`
          SELECT DISTINCT deviceId, 
                 COUNT(*) as dataCount,
                 MIN(ts) as firstSeen,
                 MAX(ts) as lastSeen
          FROM SensorData
          GROUP BY deviceId
        `),

        // 세션 관련 statements
        createSession: this.db.prepare(`
          INSERT INTO Sessions (sessionId, deviceId, startTime, status, description)
          VALUES (?, ?, ?, ?, ?)
        `),

        updateSession: this.db.prepare(`
          UPDATE Sessions 
          SET endTime = ?, status = ?, updatedAt = ?
          WHERE sessionId = ?
        `),

        getSessionsByDevice: this.db.prepare(`
          SELECT * FROM Sessions
          WHERE deviceId = ?
          ORDER BY startTime DESC
        `),

        getActiveSession: this.db.prepare(`
          SELECT * FROM Sessions
          WHERE deviceId = ? AND status = 'active'
          ORDER BY startTime DESC
          LIMIT 1
        `),

        getAllSessions: this.db.prepare(`
          SELECT 
            s.*,
            COUNT(sd.id) as dataCount,
            MIN(sd.ts) as firstDataTime,
            MAX(sd.ts) as lastDataTime
          FROM Sessions s
          LEFT JOIN SensorData sd ON s.sessionId = sd.sessionId
          GROUP BY s.sessionId
          ORDER BY s.startTime DESC
        `),

        getSensorBySession: this.db.prepare(`
          SELECT * FROM SensorData
          WHERE sessionId = ? AND ts >= ? AND ts <= ?
          ORDER BY ts DESC
          LIMIT ?
        `),

        getSessionById: this.db.prepare(`
          SELECT * FROM Sessions WHERE sessionId = ?
        `),
      };

      logger.info("Prepared statements created");
    } catch (error) {
      logger.error("Prepared statements creation failed:", error);
      throw error;
    }
  }

  // 세션 생성
  createSession(deviceId, description = null) {
    try {
      const sessionId = `${deviceId}-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      const startTime = Date.now();

      const result = this.statements.createSession.run(
        sessionId,
        deviceId,
        startTime,
        "active",
        description || `Auto-created session for ${deviceId}`
      );

      logger.info(`Session created: ${sessionId} for device ${deviceId}`);
      return {
        success: true,
        sessionId,
        startTime,
      };
    } catch (error) {
      logger.error("Create session failed:", error);
      return { success: false, error: error.message };
    }
  }

  // 세션 종료
  endSession(sessionId) {
    try {
      const endTime = Date.now();
      const result = this.statements.updateSession.run(
        endTime,
        "completed",
        endTime,
        sessionId
      );

      logger.info(`Session ended: ${sessionId}`);
      return { success: true, endTime };
    } catch (error) {
      logger.error("End session failed:", error);
      return { success: false, error: error.message };
    }
  }

  // 활성 세션 조회 또는 생성
  getOrCreateActiveSession(deviceId) {
    try {
      // 기존 활성 세션 조회
      const activeSession = this.statements.getActiveSession.get(deviceId);

      if (activeSession) {
        return {
          success: true,
          sessionId: activeSession.sessionId,
          isNew: false,
        };
      }

      // 새 세션 생성
      const newSession = this.createSession(deviceId);
      if (newSession.success) {
        return {
          success: true,
          sessionId: newSession.sessionId,
          isNew: true,
        };
      }

      return newSession;
    } catch (error) {
      logger.error("Get or create session failed:", error);
      return { success: false, error: error.message };
    }
  }

  // 세션별 센서 데이터 조회
  getSensorDataBySession(sessionId, startTime, endTime, limit = 1000) {
    try {
      const rows = this.statements.getSensorBySession.all(
        sessionId,
        startTime,
        endTime,
        limit
      );

      return rows.map((row) => ({
        ...row,
        value: JSON.parse(row.valueJson),
      }));
    } catch (error) {
      logger.error("Query by session failed:", error);
      return [];
    }
  }

  // 모든 세션 조회
  getAllSessions() {
    try {
      return this.statements.getAllSessions.all();
    } catch (error) {
      logger.error("Get all sessions failed:", error);
      return [];
    }
  }

  // 트랜잭션을 사용한 배치 삽입 (세션 지원)
  insertBatch(dataArray, sessionId = null) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return { success: false, error: "Invalid data array" };
    }

    const insert = this.db.transaction((data) => {
      let insertedCount = 0;
      for (const item of data) {
        try {
          if (sessionId || item.sessionId) {
            this.statements.insertSensor.run(
              item.deviceId,
              item.timestamp,
              item.sensorType,
              JSON.stringify(item.value),
              sessionId || item.sessionId
            );
          } else {
            this.statements.insertSensorLegacy.run(
              item.deviceId,
              item.timestamp,
              item.sensorType,
              JSON.stringify(item.value)
            );
          }
          insertedCount++;
        } catch (error) {
          logger.error(`Failed to insert item:`, {
            item,
            error: error.message,
          });
          // 개별 아이템 실패는 배치 전체를 실패시키지 않음
        }
      }
      return insertedCount;
    });

    try {
      const insertedCount = insert(dataArray);
      logger.info(
        `Batch insert completed: ${insertedCount}/${dataArray.length} records`
      );
      return { success: true, insertedCount, totalCount: dataArray.length };
    } catch (error) {
      logger.error("Batch insert failed:", error);
      return { success: false, error: error.message };
    }
  }

  // 단일 데이터 삽입 (세션 지원)
  insertSingle(data, sessionId = null) {
    try {
      let result;
      if (sessionId || data.sessionId) {
        result = this.statements.insertSensor.run(
          data.deviceId,
          data.timestamp,
          data.sensorType,
          JSON.stringify(data.value),
          sessionId || data.sessionId
        );
      } else {
        result = this.statements.insertSensorLegacy.run(
          data.deviceId,
          data.timestamp,
          data.sensorType,
          JSON.stringify(data.value)
        );
      }
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      logger.error("Single insert failed:", error);
      return { success: false, error: error.message };
    }
  }

  // 데이터 조회
  getSensorData(deviceId, startTime, endTime, limit = 1000) {
    try {
      const rows = this.statements.getSensorByDevice.all(
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
      logger.error("Query failed:", error);
      return [];
    }
  }

  // 디바이스 목록 조회
  getDevices() {
    try {
      return this.statements.getDevices.all();
    } catch (error) {
      logger.error("Get devices failed:", error);
      return [];
    }
  }

  close() {
    try {
      this.db.close();
      logger.info("Database connection closed");
    } catch (error) {
      logger.error("Database close failed:", error);
    }
  }
}

module.exports = DatabaseManager;
