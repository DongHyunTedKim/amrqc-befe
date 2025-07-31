const express = require("express");
const router = express.Router();

/**
 * GET /api/data
 * 센서 데이터 메타 정보 조회
 *
 * Query Parameters:
 * - startTs: 시작 시간 (Unix timestamp in ms)
 * - endTs: 종료 시간 (Unix timestamp in ms)
 * - deviceId: 디바이스 ID (선택)
 * - sensorType: 센서 타입 (선택)
 * - limit: 최대 결과 수 (기본값: 100, 최대: 1000)
 * - offset: 시작 위치 (기본값: 0)
 */
router.get("/", (req, res) => {
  try {
    // 쿼리 파라미터 파싱
    const {
      startTs,
      endTs,
      deviceId,
      sensorType,
      limit = "100",
      offset = "0",
    } = req.query;

    // 파라미터 검증
    const errors = [];

    if (!startTs) {
      errors.push("startTs is required");
    }
    if (!endTs) {
      errors.push("endTs is required");
    }

    const startTime = parseInt(startTs);
    const endTime = parseInt(endTs);
    const limitNum = Math.min(parseInt(limit) || 100, 1000); // 최대 1000개
    const offsetNum = parseInt(offset) || 0;

    if (isNaN(startTime)) {
      errors.push("startTs must be a valid number");
    }
    if (isNaN(endTime)) {
      errors.push("endTs must be a valid number");
    }
    if (startTime > endTime) {
      errors.push("startTs must be less than or equal to endTs");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    // 데이터베이스 인스턴스 가져오기
    const db = req.app.locals.amrServer?.db;

    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not initialized",
      });
    }

    // 동적 쿼리 생성
    let query = `
      SELECT 
        id,
        deviceId,
        ts,
        sensorType,
        valueJson,
        createdAt
      FROM SensorData
      WHERE ts >= ? AND ts <= ?
    `;

    const params = [startTime, endTime];

    if (deviceId) {
      query += " AND deviceId = ?";
      params.push(deviceId);
    }

    if (sensorType) {
      // 유효한 센서 타입 검증
      const validTypes = [
        "accelerometer",
        "gyroscope",
        "gps",
        "temperature",
        "battery",
        "magnetometer",
      ];
      if (!validTypes.includes(sensorType)) {
        return res.status(400).json({
          success: false,
          error: `Invalid sensorType. Must be one of: ${validTypes.join(", ")}`,
        });
      }
      query += " AND sensorType = ?";
      params.push(sensorType);
    }

    query += " ORDER BY ts DESC LIMIT ? OFFSET ?";
    params.push(limitNum, offsetNum);

    // 쿼리 실행
    const startQueryTime = Date.now();
    const results = db.db.prepare(query).all(...params);
    const queryTime = Date.now() - startQueryTime;

    // 전체 개수 조회 (페이징 정보용)
    let countQuery = `
      SELECT COUNT(*) as total
      FROM SensorData
      WHERE ts >= ? AND ts <= ?
    `;
    const countParams = [startTime, endTime];

    if (deviceId) {
      countQuery += " AND deviceId = ?";
      countParams.push(deviceId);
    }
    if (sensorType) {
      countQuery += " AND sensorType = ?";
      countParams.push(sensorType);
    }

    const countResult = db.db.prepare(countQuery).get(...countParams);
    const totalCount = countResult.total;

    // 결과 포맷팅
    const formattedResults = results.map((row) => ({
      id: row.id,
      deviceId: row.deviceId,
      timestamp: row.ts,
      sensorType: row.sensorType,
      value: JSON.parse(row.valueJson),
      createdAt: row.createdAt,
    }));

    // 응답
    res.json({
      success: true,
      data: formattedResults,
      pagination: {
        total: totalCount,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < totalCount,
      },
      query: {
        startTs: startTime,
        endTs: endTime,
        deviceId: deviceId || null,
        sensorType: sensorType || null,
      },
      performance: {
        queryTime: `${queryTime}ms`,
        resultCount: results.length,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/data:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * GET /api/data/summary
 * 센서 데이터 요약 정보 조회
 */
router.get("/summary", (req, res) => {
  try {
    const db = req.app.locals.amrServer?.db;

    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not initialized",
      });
    }

    // 각 디바이스별 센서 타입별 통계
    const summary = db.db
      .prepare(
        `
      SELECT 
        deviceId,
        sensorType,
        COUNT(*) as count,
        MIN(ts) as minTime,
        MAX(ts) as maxTime,
        COUNT(DISTINCT DATE(ts/1000, 'unixepoch')) as days
      FROM SensorData
      GROUP BY deviceId, sensorType
      ORDER BY deviceId, sensorType
    `
      )
      .all();

    // 전체 통계
    const totalStats = db.db
      .prepare(
        `
      SELECT 
        COUNT(*) as totalRecords,
        COUNT(DISTINCT deviceId) as totalDevices,
        COUNT(DISTINCT sensorType) as totalSensorTypes,
        MIN(ts) as minTime,
        MAX(ts) as maxTime
      FROM SensorData
    `
      )
      .get();

    res.json({
      success: true,
      data: {
        total: totalStats,
        byDevice: summary.reduce((acc, row) => {
          if (!acc[row.deviceId]) {
            acc[row.deviceId] = {
              totalRecords: 0,
              sensors: {},
              timeRange: {
                start: row.minTime,
                end: row.maxTime,
              },
            };
          }

          acc[row.deviceId].totalRecords += row.count;
          acc[row.deviceId].sensors[row.sensorType] = {
            count: row.count,
            days: row.days,
            timeRange: {
              start: row.minTime,
              end: row.maxTime,
            },
          };

          // 전체 시간 범위 업데이트
          acc[row.deviceId].timeRange.start = Math.min(
            acc[row.deviceId].timeRange.start,
            row.minTime
          );
          acc[row.deviceId].timeRange.end = Math.max(
            acc[row.deviceId].timeRange.end,
            row.maxTime
          );

          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Error in GET /api/data/summary:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * GET /api/data/devices
 * 디바이스 목록 조회
 */
router.get("/devices", (req, res) => {
  try {
    const db = req.app.locals.amrServer?.db;

    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not initialized",
      });
    }

    const devices = db.statements.getDevices.all();

    res.json({
      success: true,
      data: devices.map((device) => ({
        deviceId: device.deviceId,
        dataCount: device.dataCount,
        firstSeen: device.firstSeen,
        lastSeen: device.lastSeen,
        active: Date.now() - device.lastSeen < 60000, // 1분 이내 데이터가 있으면 활성
      })),
    });
  } catch (error) {
    console.error("Error in GET /api/data/devices:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * GET /api/data/download
 * 센서 데이터를 CSV 파일로 다운로드
 *
 * Query Parameters:
 * - startTs: 시작 시간 (Unix timestamp in ms) - 필수
 * - endTs: 종료 시간 (Unix timestamp in ms) - 필수
 * - deviceId: 디바이스 ID - 필수
 */
router.get("/download", (req, res) => {
  try {
    // 쿼리 파라미터 파싱
    const { startTs, endTs, deviceId } = req.query;

    // 파라미터 검증
    const errors = [];

    if (!startTs) {
      errors.push("startTs is required");
    }
    if (!endTs) {
      errors.push("endTs is required");
    }
    if (!deviceId) {
      errors.push("deviceId is required");
    }

    const startTime = parseInt(startTs);
    const endTime = parseInt(endTs);

    if (isNaN(startTime)) {
      errors.push("startTs must be a valid number");
    }
    if (isNaN(endTime)) {
      errors.push("endTs must be a valid number");
    }
    if (startTime > endTime) {
      errors.push("startTs must be less than or equal to endTs");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    // 데이터베이스 인스턴스 가져오기
    const db = req.app.locals.amrServer?.db;

    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not initialized",
      });
    }

    // 데이터 조회 쿼리
    const query = `
      SELECT 
        id,
        deviceId,
        ts,
        sensorType,
        valueJson
      FROM SensorData
      WHERE ts >= ? AND ts <= ? AND deviceId = ?
      ORDER BY ts ASC
    `;

    const results = db.db.prepare(query).all(startTime, endTime, deviceId);

    // CSV 헤더 설정
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="sensor-data-${deviceId}-${Date.now()}.csv"`
    );

    // CSV 헤더 작성
    res.write("id,deviceId,ts,sensorType,valueJson\n");

    // 데이터 행 작성
    for (const row of results) {
      // CSV 특수 문자 이스케이프 처리
      const escapedValueJson = row.valueJson.replace(/"/g, '""');
      res.write(
        `${row.id},"${row.deviceId}",${row.ts},"${row.sensorType}","${escapedValueJson}"\n`
      );
    }

    // 응답 종료
    res.end();

    // 로그 기록
    console.log(`Downloaded ${results.length} records for device ${deviceId}`);
  } catch (error) {
    console.error("Error in GET /api/data/download:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

module.exports = router;
