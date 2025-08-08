const express = require("express");
const os = require("os");
const router = express.Router();

/**
 * 서버의 네트워크 정보를 가져옵니다
 */
function getNetworkInfo() {
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

  // 첫 번째 IP를 기본으로 사용, 없으면 localhost
  const primaryIP = localIPs[0] || "localhost";

  return {
    primaryIP,
    allIPs: localIPs,
    hostname: os.hostname(),
  };
}

/**
 * GET /api/server/info
 * 서버 연결 정보 조회
 */
router.get("/info", (req, res) => {
  const networkInfo = getNetworkInfo();
  const wsPort = process.env.WS_PORT || 8001;
  const httpPort = process.env.HTTP_PORT || 8000;

  res.json({
    success: true,
    data: {
      network: networkInfo,
      urls: {
        websocket: `ws://${networkInfo.primaryIP}:${wsPort}`,
        http: `http://${networkInfo.primaryIP}:${httpPort}`,
        allWebsocketUrls: networkInfo.allIPs.map(
          (ip) => `ws://${ip}:${wsPort}`
        ),
      },
      ports: {
        websocket: parseInt(wsPort),
        http: parseInt(httpPort),
      },
    },
  });
});

/**
 * GET /api/server/status
 * 서버 상태 조회
 */
router.get("/status", (req, res) => {
  // 서버 인스턴스가 app.locals에 저장되어 있다고 가정
  const server = req.app.locals.amrServer;

  if (!server) {
    return res.json({
      success: true,
      data: {
        status: "running",
        startTime: Date.now(),
        uptime: 0,
        websocket: {
          connected: false,
          connections: 0,
        },
      },
    });
  }

  const stats = server.getStats();

  // 스마트폰만 카운트 (deviceId가 등록된 클라이언트만)
  const smartphoneConnections = server.wsServer?.getConnectedDevices
    ? server.wsServer.getConnectedDevices().length
    : 0;

  res.json({
    success: true,
    data: {
      status: "running",
      startTime: stats.startTime,
      uptime: stats.uptime,
      websocket: {
        connected: true,
        connections: smartphoneConnections, // 스마트폰만 카운트
        totalConnections: stats.server?.currentConnections || 0, // 전체 연결 (웹 클라이언트 포함)
        messagesReceived: stats.server?.messagesReceived || 0,
      },
      queue: {
        size: stats.queue?.currentQueueSize || 0,
        lossRate: stats.queue?.lossRate || "0.00",
        batchCount: stats.queue?.batchCount || 0,
      },
    },
  });
});

/**
 * GET /api/server/devices
 * 연결된 디바이스 목록 조회
 */
router.get("/devices", (req, res) => {
  const server = req.app.locals.amrServer;

  if (!server || !server.wsServer) {
    return res.json({
      success: true,
      data: {
        devices: [],
        count: 0,
      },
    });
  }

  // WebSocket 서버에서 연결된 클라이언트 정보 가져오기
  const devices = server.wsServer.getConnectedDevices
    ? server.wsServer.getConnectedDevices()
    : [];

  res.json({
    success: true,
    data: {
      devices,
      count: devices.length,
    },
  });
});

/**
 * POST /api/server/disconnect-device
 * 특정 디바이스 강제 연결 해제
 */
router.post("/disconnect-device", (req, res) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.status(400).json({
      success: false,
      error: "deviceId is required",
    });
  }

  const server = req.app.locals.amrServer;

  if (!server || !server.wsServer) {
    return res.status(500).json({
      success: false,
      error: "WebSocket server not available",
    });
  }

  // 디바이스 연결 해제 실행
  const result = server.wsServer.disconnectDevice(deviceId);

  if (result.success) {
    res.json({
      success: true,
      message: result.message,
    });
  } else {
    res.status(404).json({
      success: false,
      error: result.error,
    });
  }
});

module.exports = router;
