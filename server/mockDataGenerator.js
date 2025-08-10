const DatabaseManager = require("./db");
const winston = require("winston");

// 로거 설정
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()],
});

/**
 * Mock 센서 데이터 생성기
 * 실제 스마트폰 센서와 동일한 형태의 데이터를 생성하여 DB에 저장
 */
class MockDataGenerator {
  constructor(dbPath = "./data.db") {
    this.db = new DatabaseManager(dbPath);
    this.devices = ["AMR-001", "AMR-002", "AMR-003", "AMR-004", "AMR-005"];
    this.sensorTypes = [
      "accelerometer",
      "gyroscope",
      "gps",
      "temperature",
      "battery",
      "magnetometer",
    ];
    // 세션 생성을 위한 디바이스별 세션 ID 맵
    this.deviceSessions = new Map();
  }

  // 랜덤 센서 값 생성
  generateSensorValue(sensorType) {
    switch (sensorType) {
      case "accelerometer":
        return {
          x: (Math.random() - 0.5) * 2, // -1 ~ 1 m/s²
          y: (Math.random() - 0.5) * 2,
          z: 9.8 + (Math.random() - 0.5) * 0.5, // 중력 가속도 ± 노이즈
        };

      case "gyroscope":
        return {
          x: (Math.random() - 0.5) * 0.5, // -0.25 ~ 0.25 rad/s
          y: (Math.random() - 0.5) * 0.5,
          z: (Math.random() - 0.5) * 0.5,
        };

      case "gps":
        return {
          latitude: 37.5665 + (Math.random() - 0.5) * 0.01, // 서울 시청 근처
          longitude: 126.978 + (Math.random() - 0.5) * 0.01,
          altitude: 50 + Math.random() * 10,
          accuracy: 5 + Math.random() * 10,
        };

      case "temperature":
        return {
          value: 20 + Math.random() * 10, // 20-30°C
          unit: "celsius",
        };

      case "battery":
        return {
          level: Math.floor(20 + Math.random() * 80), // 20-100%
          isCharging: Math.random() > 0.8,
          temperature: 25 + Math.random() * 10,
        };

      case "magnetometer":
        return {
          x: (Math.random() - 0.5) * 100, // -50 ~ 50 μT
          y: (Math.random() - 0.5) * 100,
          z: (Math.random() - 0.5) * 100,
        };

      default:
        return { value: Math.random() * 100 };
    }
  }

  // UUID 생성 함수
  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // 특정 기간 동안의 Mock 데이터 생성
  generateMockData(options = {}) {
    const {
      startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 기본 7일 전
      endDate = new Date(),
      intervalMs = 1000, // 1초 간격
      devicesCount = 3, // 활성 디바이스 수
    } = options;

    const activeDevices = this.devices.slice(0, devicesCount);
    const dataPoints = [];

    // 각 디바이스별로 세션 생성
    activeDevices.forEach((deviceId) => {
      const sessionId = this.generateSessionId();
      this.deviceSessions.set(deviceId, sessionId);

      // 세션 생성
      try {
        this.db.statements.createSession.run(
          sessionId,
          deviceId,
          startDate.getTime(),
          "active",
          `Mock data session for ${deviceId}`
        );
        logger.info(`Created session ${sessionId} for device ${deviceId}`);
      } catch (error) {
        logger.warn(
          `Session creation failed for ${deviceId}: ${error.message}`
        );
      }
    });

    logger.info(
      `Generating mock data from ${startDate.toISOString()} to ${endDate.toISOString()}`
    );
    logger.info(`Active devices: ${activeDevices.join(", ")}`);

    let currentTime = startDate.getTime();
    const endTime = endDate.getTime();
    let count = 0;

    while (currentTime <= endTime) {
      // 각 디바이스별로 데이터 생성
      activeDevices.forEach((deviceId) => {
        // 각 센서 타입별로 데이터 생성 (랜덤하게 일부만)
        const activeSensors = this.sensorTypes.filter(
          () => Math.random() > 0.3
        );

        activeSensors.forEach((sensorType) => {
          const sensorData = {
            deviceId,
            sensorType,
            timestamp: currentTime,
            value: this.generateSensorValue(sensorType),
            sessionId: this.deviceSessions.get(deviceId), // 세션 ID 추가
            metadata: {
              accuracy: Math.random() * 10,
              source: "mock-generator",
              amrId: deviceId, // 스마트폰이 거치된 AMR ID
            },
          };

          dataPoints.push(sensorData);
          count++;
        });
      });

      currentTime += intervalMs;

      // 진행 상황 로깅 (10초마다)
      if (count % (10 * activeDevices.length * 4) === 0) {
        const progress = (
          ((currentTime - startDate.getTime()) /
            (endTime - startDate.getTime())) *
          100
        ).toFixed(1);
        logger.info(`Progress: ${progress}% - Generated ${count} data points`);
      }
    }

    logger.info(`Total data points generated: ${count}`);
    return dataPoints;
  }

  // 데이터베이스에 Mock 데이터 저장
  async saveMockData(dataPoints) {
    logger.info("Saving mock data to database...");

    const batchSize = 1000;
    let saved = 0;

    try {
      // 배치로 나누어 저장
      for (let i = 0; i < dataPoints.length; i += batchSize) {
        const batch = dataPoints.slice(i, i + batchSize);

        this.db.db.transaction(() => {
          batch.forEach((data) => {
            this.db.statements.insertSensor.run(
              data.deviceId,
              data.timestamp,
              data.sensorType,
              JSON.stringify(data.value),
              data.sessionId || null // sessionId 파라미터 추가
            );
          });
        })();

        saved += batch.length;
        logger.info(`Saved ${saved}/${dataPoints.length} data points`);
      }

      logger.info("✅ Mock data saved successfully!");

      // 세션을 완료 상태로 업데이트
      this.deviceSessions.forEach((sessionId, deviceId) => {
        try {
          this.db.statements.updateSession.run(
            Date.now(), // endTime
            "completed", // status
            Date.now(), // updatedAt
            sessionId
          );
          logger.info(`Session ${sessionId} for device ${deviceId} completed`);
        } catch (error) {
          logger.warn(
            `Failed to update session ${sessionId}: ${error.message}`
          );
        }
      });

      // 통계 출력
      this.printStatistics();
    } catch (error) {
      logger.error("Error saving mock data:", error);
      throw error;
    }
  }

  // 저장된 데이터 통계 출력
  printStatistics() {
    const stats = this.db.db
      .prepare(
        `
      SELECT 
        deviceId,
        sensorType,
        COUNT(*) as count,
        MIN(ts) as minTime,
        MAX(ts) as maxTime
      FROM SensorData
      GROUP BY deviceId, sensorType
      ORDER BY deviceId, sensorType
    `
      )
      .all();

    logger.info("\n📊 Database Statistics:");
    logger.info("─".repeat(80));

    const deviceStats = {};
    stats.forEach((stat) => {
      if (!deviceStats[stat.deviceId]) {
        deviceStats[stat.deviceId] = {
          total: 0,
          sensors: [],
          minTime: stat.minTime,
          maxTime: stat.maxTime,
        };
      }
      deviceStats[stat.deviceId].total += stat.count;
      deviceStats[stat.deviceId].sensors.push(
        `${stat.sensorType}: ${stat.count}`
      );
    });

    Object.entries(deviceStats).forEach(([deviceId, info]) => {
      logger.info(`\n${deviceId}:`);
      logger.info(`  Total records: ${info.total}`);
      logger.info(
        `  Time range: ${new Date(info.minTime).toLocaleString()} ~ ${new Date(
          info.maxTime
        ).toLocaleString()}`
      );
      logger.info(`  Sensors: ${info.sensors.join(", ")}`);
    });

    const totalRecords = this.db.db
      .prepare("SELECT COUNT(*) as count FROM SensorData")
      .get();
    logger.info(`\n📈 Total records in database: ${totalRecords.count}`);
    logger.info("─".repeat(80));
  }

  // 데이터베이스 완전 초기화 (기존 데이터 삭제 + 파일 크기 축소)
  clearDatabase() {
    logger.warn("⚠️  Clearing all sensor data from database...");

    try {
      // 1. 모든 데이터 삭제
      const deleteResult = this.db.db.prepare("DELETE FROM SensorData").run();
      logger.info(
        `🗑️  Deleted ${deleteResult.changes} records from SensorData table`
      );

      // 2. 데이터베이스 파일 크기 축소 (VACUUM)
      logger.info("🔧 Compacting database file...");
      this.db.db.exec("VACUUM");

      // 3. 통계 정보 재수집
      this.db.db.exec("ANALYZE");

      // 4. WAL 체크포인트 (WAL 파일을 메인 DB로 병합)
      this.db.db.exec("PRAGMA wal_checkpoint(FULL)");

      logger.info("✅ Database cleared and compacted successfully");

      return {
        deletedRecords: deleteResult.changes,
        success: true,
      };
    } catch (error) {
      logger.error("❌ Error during database clearing:", error);
      throw error;
    }
  }

  close() {
    this.db.close();
  }
}

// CLI로 직접 실행
if (require.main === module) {
  const generator = new MockDataGenerator();

  // 명령줄 인자 파싱
  const args = process.argv.slice(2);
  const command = args[0] || "generate";

  switch (command) {
    case "clear":
      generator.clearDatabase();
      break;

    case "stats":
      generator.printStatistics();
      break;

    case "generate":
    default:
      // 옵션 파싱
      const days = parseInt(args[1]) || 7;
      const interval = parseInt(args[2]) || 1000;
      const devices = parseInt(args[3]) || 3;

      logger.info(`📊 Mock Data Generator`);
      logger.info(`  Days: ${days}`);
      logger.info(`  Interval: ${interval}ms`);
      logger.info(`  Devices: ${devices}`);

      // Mock 데이터 생성
      const mockData = generator.generateMockData({
        startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        intervalMs: interval,
        devicesCount: devices,
      });

      // 데이터베이스에 저장
      generator.saveMockData(mockData);
      break;
  }

  generator.close();
}

module.exports = MockDataGenerator;
