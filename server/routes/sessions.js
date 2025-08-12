const express = require("express");
const router = express.Router();

/**
 * GET /api/sessions
 * 모든 세션 목록 조회
 *
 * Query Parameters:
 * - deviceId: 특정 디바이스의 세션만 조회 (선택)
 * - status: 세션 상태 필터 (active, completed, error, paused)
 * - limit: 최대 결과 수 (기본값: 50, 최대: 200)
 * - offset: 시작 위치 (기본값: 0)
 */
router.get("/", (req, res) => {
  try {
    const db = req.app.locals.amrServer?.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not initialized",
      });
    }

    const { deviceId, status, limit = "50", offset = "0" } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 200);
    const offsetNum = parseInt(offset) || 0;

    // 동적 쿼리 생성
    let query = `
      SELECT 
        s.*,
        COUNT(sd.id) as dataCount,
        MIN(sd.ts) as firstDataTime,
        MAX(sd.ts) as lastDataTime
      FROM Sessions s
      LEFT JOIN SensorData sd ON s.sessionId = sd.sessionId
    `;

    const conditions = [];
    const params = [];

    if (deviceId) {
      conditions.push("s.deviceId = ?");
      params.push(deviceId);
    }

    if (status) {
      const validStatuses = ["active", "completed", "error", "paused"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        });
      }
      conditions.push("s.status = ?");
      params.push(status);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " GROUP BY s.sessionId ORDER BY s.startTime DESC LIMIT ? OFFSET ?";
    params.push(limitNum, offsetNum);

    const results = db.db.prepare(query).all(...params);

    res.json({
      success: true,
      data: results.map((session) => ({
        sessionId: session.sessionId,
        deviceId: session.deviceId,
        startTime: session.startTime,
        endTime: session.endTime,
        status: session.status,
        description: session.description,
        metadata: session.metadata ? JSON.parse(session.metadata) : null,
        dataCount: session.dataCount || 0,
        firstDataTime: session.firstDataTime,
        lastDataTime: session.lastDataTime,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })),
      pagination: {
        limit: limitNum,
        offset: offsetNum,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/sessions:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * POST /api/sessions
 * 새 세션 생성
 *
 * Body:
 * - deviceId: 디바이스 ID (필수)
 * - description: 세션 설명 (선택)
 * - metadata: 추가 메타데이터 JSON (선택)
 */
router.post("/", (req, res) => {
  try {
    const db = req.app.locals.amrServer?.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not initialized",
      });
    }

    const { deviceId, description, metadata } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: "deviceId is required",
      });
    }

    // 활성 세션이 있는지 확인
    const activeSession = db.statements.getActiveSession?.get(deviceId);
    if (activeSession) {
      return res.status(400).json({
        success: false,
        error: "Active session already exists for this device",
        existingSessionId: activeSession.sessionId,
      });
    }

    // 새 세션 생성
    const result = db.createSession(deviceId, description);

    if (result.success) {
      // 메타데이터가 있으면 업데이트
      if (metadata) {
        db.db
          .prepare("UPDATE Sessions SET metadata = ? WHERE sessionId = ?")
          .run(JSON.stringify(metadata), result.sessionId);
      }

      res.status(201).json({
        success: true,
        data: {
          sessionId: result.sessionId,
          deviceId,
          startTime: result.startTime,
          status: "active",
          description: description || `Auto-created session for ${deviceId}`,
          metadata,
        },
      });
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error("Error in POST /api/sessions:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * GET /api/sessions/:sessionId
 * 특정 세션 상세 정보 조회
 */
router.get("/:sessionId", (req, res) => {
  try {
    const db = req.app.locals.amrServer?.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not initialized",
      });
    }

    const { sessionId } = req.params;
    const session = db.statements.getSessionById?.get(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    // 세션의 데이터 통계 조회
    const stats = db.db
      .prepare(
        `
      SELECT 
        COUNT(*) as totalCount,
        COUNT(DISTINCT sensorType) as sensorTypeCount,
        MIN(ts) as firstDataTime,
        MAX(ts) as lastDataTime
      FROM SensorData
      WHERE sessionId = ?
    `
      )
      .get(sessionId);

    res.json({
      success: true,
      data: {
        ...session,
        metadata: session.metadata ? JSON.parse(session.metadata) : null,
        stats,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/sessions/:sessionId:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * PUT /api/sessions/:sessionId/end
 * 세션 종료
 */
router.put("/:sessionId/end", (req, res) => {
  try {
    const db = req.app.locals.amrServer?.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not initialized",
      });
    }

    const { sessionId } = req.params;
    const session = db.statements.getSessionById?.get(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    if (session.status !== "active") {
      return res.status(400).json({
        success: false,
        error: "Session is not active",
        currentStatus: session.status,
      });
    }

    const result = db.endSession(sessionId);

    if (result.success) {
      res.json({
        success: true,
        data: {
          sessionId,
          endTime: result.endTime,
          status: "completed",
        },
      });
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error("Error in PUT /api/sessions/:sessionId/end:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * DELETE /api/sessions/:sessionId
 * 단일 세션과 해당 센서 데이터를 삭제 (활성 세션은 삭제 불가)
 */
router.delete("/:sessionId", (req, res) => {
  try {
    const db = req.app.locals.amrServer?.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not initialized",
      });
    }

    const { sessionId } = req.params;

    const session = db.statements.getSessionById?.get(sessionId);
    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    // 활성 세션은 삭제 불가
    if (session.status === "active") {
      return res.status(409).json({
        success: false,
        error: "Cannot delete an active session",
      });
    }

    const tx = db.db.transaction(() => {
      const delData = db.db
        .prepare("DELETE FROM SensorData WHERE sessionId = ?")
        .run(sessionId);
      const delSession = db.db
        .prepare("DELETE FROM Sessions WHERE sessionId = ?")
        .run(sessionId);
      return {
        deletedData: delData.changes,
        deletedSessions: delSession.changes,
      };
    });

    const result = tx();

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error in DELETE /api/sessions/:sessionId:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * POST /api/sessions/delete-batch
 * 여러 세션을 일괄 삭제 (활성 세션은 삭제 불가)
 * Body: { sessionIds: string[] }
 */
router.post("/delete-batch", (req, res) => {
  try {
    const db = req.app.locals.amrServer?.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not initialized",
      });
    }

    const { sessionIds } = req.body || {};
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "sessionIds is required" });
    }

    const activeIds = [];
    for (const id of sessionIds) {
      const s = db.statements.getSessionById?.get(id);
      if (s && s.status === "active") activeIds.push(id);
    }
    if (activeIds.length > 0) {
      return res.status(409).json({
        success: false,
        error: "Active sessions included. Cannot delete active sessions.",
        activeIds,
      });
    }

    const tx = db.db.transaction((ids) => {
      let deletedData = 0;
      let deletedSessions = 0;
      const delDataStmt = db.db.prepare(
        "DELETE FROM SensorData WHERE sessionId = ?"
      );
      const delSessionStmt = db.db.prepare(
        "DELETE FROM Sessions WHERE sessionId = ?"
      );
      for (const id of ids) {
        deletedData += delDataStmt.run(id).changes;
        deletedSessions += delSessionStmt.run(id).changes;
      }
      return { deletedData, deletedSessions };
    });

    const result = tx(sessionIds);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error in POST /api/sessions/delete-batch:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * 대안 엔드포인트: DELETE /api/sessions (bulk)
 * Body: { sessionIds: string[] }
 */
router.delete("/", (req, res) => {
  try {
    const { sessionIds } = req.body || {};
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "sessionIds is required" });
    }
    // 내부적으로 기존 배치 삭제 로직 재사용
    req.body = { sessionIds };
    return router.handle({ ...req, method: "POST", url: "/delete-batch" }, res);
  } catch (error) {
    console.error("Error in DELETE /api/sessions:", error);
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
});
/**
 * GET /api/sessions/:sessionId/data
 * 세션의 센서 데이터 조회
 *
 * Query Parameters:
 * - startTs: 시작 시간 (Unix timestamp in ms)
 * - endTs: 종료 시간 (Unix timestamp in ms)
 * - sensorType: 센서 타입 필터 (선택)
 * - limit: 최대 결과 수 (기본값: 100, 최대: 1000)
 * - offset: 시작 위치 (기본값: 0)
 */
router.get("/:sessionId/data", (req, res) => {
  try {
    const db = req.app.locals.amrServer?.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not initialized",
      });
    }

    const { sessionId } = req.params;
    const {
      startTs,
      endTs,
      sensorType,
      limit = "100",
      offset = "0",
    } = req.query;

    // 세션 존재 확인
    const session = db.statements.getSessionById?.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    const limitNum = Math.min(parseInt(limit) || 100, 1000);
    const offsetNum = parseInt(offset) || 0;

    // 시간 범위 설정 (없으면 세션 전체 범위)
    const startTime = startTs ? parseInt(startTs) : session.startTime;
    const endTime = endTs ? parseInt(endTs) : session.endTime || Date.now();

    // 쿼리 생성
    let query = `
      SELECT * FROM SensorData
      WHERE sessionId = ? AND ts >= ? AND ts <= ?
    `;
    const params = [sessionId, startTime, endTime];

    if (sensorType) {
      query += " AND sensorType = ?";
      params.push(sensorType);
    }

    query += " ORDER BY ts DESC LIMIT ? OFFSET ?";
    params.push(limitNum, offsetNum);

    const results = db.db.prepare(query).all(...params);

    // 전체 개수 조회
    let countQuery = `
      SELECT COUNT(*) as total FROM SensorData
      WHERE sessionId = ? AND ts >= ? AND ts <= ?
    `;
    const countParams = [sessionId, startTime, endTime];
    if (sensorType) {
      countQuery += " AND sensorType = ?";
      countParams.push(sensorType);
    }

    const countResult = db.db.prepare(countQuery).get(...countParams);

    res.json({
      success: true,
      data: results.map((row) => ({
        id: row.id,
        deviceId: row.deviceId,
        sessionId: row.sessionId,
        timestamp: row.ts,
        sensorType: row.sensorType,
        value: JSON.parse(row.valueJson),
        createdAt: row.createdAt,
      })),
      pagination: {
        total: countResult.total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < countResult.total,
      },
      session: {
        sessionId: session.sessionId,
        deviceId: session.deviceId,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/sessions/:sessionId/data:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

/**
 * GET /api/sessions/:sessionId/download
 * 세션의 센서 데이터를 CSV 파일로 다운로드
 *
 * Query Parameters:
 * - sensorType: 센서 타입 필터 (선택)
 * - format: 다운로드 형식 (csv, json) - 기본값: csv
 */
router.get("/:sessionId/download", (req, res) => {
  try {
    const db = req.app.locals.amrServer?.db;
    if (!db) {
      return res.status(500).json({
        success: false,
        error: "Database not initialized",
      });
    }

    const { sessionId } = req.params;
    const { sensorType, format = "csv" } = req.query;

    // 세션 존재 확인
    const session = db.statements.getSessionById?.get(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    // 쿼리 생성
    let query = `
      SELECT * FROM SensorData
      WHERE sessionId = ?
    `;
    const params = [sessionId];

    if (sensorType) {
      query += " AND sensorType = ?";
      params.push(sensorType);
    }

    query += " ORDER BY ts ASC";
    const results = db.db.prepare(query).all(...params);

    if (format === "json") {
      // JSON 형식으로 다운로드
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="session-${sessionId}-${Date.now()}.json"`
      );

      const jsonData = results.map((row) => ({
        id: row.id,
        deviceId: row.deviceId,
        sessionId: row.sessionId,
        timestamp_unix: row.ts,
        timestamp_iso: new Date(row.ts).toISOString(),
        sensorType: row.sensorType,
        value: JSON.parse(row.valueJson),
        createdAt: row.createdAt,
      }));

      res.json({
        session: {
          sessionId: session.sessionId,
          deviceId: session.deviceId,
          startTime: session.startTime,
          endTime: session.endTime,
          status: session.status,
        },
        data: jsonData,
        exportedAt: new Date().toISOString(),
        totalRecords: results.length,
      });
    } else {
      // CSV 형식으로 다운로드 (기본값)
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      const sensorFilter = sensorType ? `-${sensorType}` : "";
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="session-${sessionId}${sensorFilter}-${Date.now()}.csv"`
      );

      // CSV 헤더 작성
      res.write(
        "id,deviceId,sessionId,timestamp_unix,timestamp_iso,sensorType,valueJson\n"
      );

      // 데이터 행 작성
      for (const row of results) {
        // CSV 특수 문자 이스케이프 처리
        const escapedValueJson = row.valueJson.replace(/"/g, '""');

        // Unix timestamp를 ISO 8601 형식으로 변환
        const isoDate = new Date(row.ts).toISOString();

        res.write(
          `${row.id},"${row.deviceId}","${row.sessionId}",${row.ts},"${isoDate}","${row.sensorType}","${escapedValueJson}"\n`
        );
      }

      res.end();
    }

    // 로그 기록
    console.log(
      `Downloaded ${results.length} records for session ${sessionId} (${format} format)`
    );
  } catch (error) {
    console.error("Error in GET /api/sessions/:sessionId/download:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: error.message,
    });
  }
});

module.exports = router;
