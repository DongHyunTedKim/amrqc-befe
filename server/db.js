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
          CONSTRAINT chk_sensorType CHECK (sensorType IN ('accelerometer', 'gyroscope', 'gps', 'temperature', 'battery', 'magnetometer'))
        );
      `);

      // 인덱스 생성
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_sensor_device_time ON SensorData(deviceId, ts);
        CREATE INDEX IF NOT EXISTS idx_sensor_type_time ON SensorData(sensorType, ts);
        CREATE INDEX IF NOT EXISTS idx_sensor_device_type_time ON SensorData(deviceId, sensorType, ts);
        CREATE INDEX IF NOT EXISTS idx_sensor_time ON SensorData(ts);
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
      };

      logger.info("Prepared statements created");
    } catch (error) {
      logger.error("Prepared statements creation failed:", error);
      throw error;
    }
  }

  // 트랜잭션을 사용한 배치 삽입
  insertBatch(dataArray) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return { success: false, error: "Invalid data array" };
    }

    const insert = this.db.transaction((data) => {
      let insertedCount = 0;
      for (const item of data) {
        try {
          this.statements.insertSensor.run(
            item.deviceId,
            item.timestamp,
            item.sensorType,
            JSON.stringify(item.value)
          );
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

  // 단일 데이터 삽입
  insertSingle(data) {
    try {
      const result = this.statements.insertSensor.run(
        data.deviceId,
        data.timestamp,
        data.sensorType,
        JSON.stringify(data.value)
      );
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
