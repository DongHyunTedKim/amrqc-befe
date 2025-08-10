const express = require("express");
const router = express.Router();
const MockDataGenerator = require("../mockDataGenerator");

/**
 * POST /api/mock/generate
 * Mock 데이터 생성
 *
 * Body Parameters:
 * - minutes: 생성할 데이터 기간 (분 단위, 기본값: 10) 또는 days (호환성)
 * - interval: 데이터 생성 간격 (ms, 기본값: 1000)
 * - devices: 활성 디바이스 수 (기본값: 3)
 */
router.post("/generate", async (req, res) => {
  try {
    // 분 단위와 일 단위 모두 지원 (호환성)
    let { minutes, days, interval = 1000, devices = 3 } = req.body;

    // 분 단위가 있으면 우선 사용, 없으면 days를 분으로 변환
    if (minutes !== undefined) {
      // 분 단위 파라미터 검증
      if (minutes < 1 || minutes > 43200) {
        // 최대 30일 = 43200분
        return res.status(400).json({
          success: false,
          error: "minutes must be between 1 and 43200 (30 days)",
        });
      }
      // 분을 일로 변환하여 기존 로직 재사용
      days = minutes / (24 * 60);
    } else {
      // 기존 days 파라미터 사용 (하위 호환성)
      days = days || 1;
      minutes = days * 24 * 60;
      if (days < 0.1 || days > 30) {
        return res.status(400).json({
          success: false,
          error: "days must be between 0.1 and 30",
        });
      }
    }

    if (interval < 100 || interval > 60000) {
      return res.status(400).json({
        success: false,
        error: "interval must be between 100 and 60000 ms",
      });
    }

    if (devices < 1 || devices > 5) {
      return res.status(400).json({
        success: false,
        error: "devices must be between 1 and 5",
      });
    }

    const generator = new MockDataGenerator();

    // Mock 데이터 생성
    const mockData = generator.generateMockData({
      startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      endDate: new Date(),
      intervalMs: interval,
      devicesCount: devices,
    });

    // 데이터베이스에 저장
    await generator.saveMockData(mockData);

    generator.close();

    res.json({
      success: true,
      message: `Successfully generated ${mockData.length} data points`,
      details: {
        minutes: Math.round(minutes),
        days: Number(days.toFixed(3)),
        interval,
        devices,
        totalRecords: mockData.length,
      },
    });
  } catch (error) {
    console.error("Error generating mock data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate mock data",
      message: error.message,
    });
  }
});

/**
 * DELETE /api/mock/clear
 * 모든 센서 데이터 삭제 (VACUUM 포함)
 */
router.delete("/clear", async (req, res) => {
  try {
    const generator = new MockDataGenerator();
    const result = generator.clearDatabase();
    generator.close();

    res.json({
      success: true,
      message: "All sensor data cleared and database compacted successfully",
      data: {
        deletedRecords: result.deletedRecords,
        operations: [
          "데이터 레코드 삭제",
          "데이터베이스 파일 압축 (VACUUM)",
          "통계 정보 재수집 (ANALYZE)",
          "WAL 파일 체크포인트",
        ],
      },
    });
  } catch (error) {
    console.error("Error clearing database:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear database",
      message: error.message,
    });
  }
});

/**
 * GET /api/mock/status
 * 현재 데이터베이스 상태 조회
 */
router.get("/status", async (req, res) => {
  try {
    const db = req.app.locals.amrServer?.db;

    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not initialized",
      });
    }

    // 전체 통계 조회
    const totalStats = db.db
      .prepare(
        `
      SELECT 
        COUNT(*) as totalRecords,
        COUNT(DISTINCT deviceId) as totalDevices,
        MIN(ts) as minTime,
        MAX(ts) as maxTime
      FROM SensorData
    `
      )
      .get();

    // 디바이스별 통계
    const deviceStats = db.db
      .prepare(
        `
      SELECT 
        deviceId,
        COUNT(*) as count
      FROM SensorData
      GROUP BY deviceId
      ORDER BY deviceId
    `
      )
      .all();

    res.json({
      success: true,
      data: {
        totalRecords: totalStats.totalRecords || 0,
        totalDevices: totalStats.totalDevices || 0,
        timeRange: {
          start: totalStats.minTime,
          end: totalStats.maxTime,
        },
        devices: deviceStats,
        databaseSize: Math.round(totalStats.totalRecords * 0.1) + " KB", // 추정 크기
      },
    });
  } catch (error) {
    console.error("Error getting mock data status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get status",
      message: error.message,
    });
  }
});

module.exports = router;
