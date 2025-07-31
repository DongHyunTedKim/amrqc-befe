const express = require("express");
const router = express.Router();
const MockDataGenerator = require("../mockDataGenerator");

/**
 * POST /api/mock/generate
 * Mock 데이터 생성
 *
 * Body Parameters:
 * - days: 생성할 데이터 기간 (일 단위, 기본값: 1)
 * - interval: 데이터 생성 간격 (ms, 기본값: 1000)
 * - devices: 활성 디바이스 수 (기본값: 3)
 */
router.post("/generate", async (req, res) => {
  try {
    const { days = 1, interval = 1000, devices = 3 } = req.body;

    // 파라미터 검증
    if (days < 0.1 || days > 30) {
      return res.status(400).json({
        success: false,
        error: "days must be between 0.1 and 30",
      });
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
        days,
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
 * 모든 센서 데이터 삭제
 */
router.delete("/clear", async (req, res) => {
  try {
    const generator = new MockDataGenerator();
    generator.clearDatabase();
    generator.close();

    res.json({
      success: true,
      message: "All sensor data cleared successfully",
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
