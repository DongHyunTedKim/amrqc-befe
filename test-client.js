const WebSocket = require("ws");

/**
 * WebSocket 서버 테스트 클라이언트
 * - 연결 테스트
 * - 센서 데이터 전송 시뮬레이션
 */
class TestClient {
  constructor(url = "ws://localhost:8001") {
    this.url = url;
    this.ws = null;
    this.deviceId = "TEST-AMR-001";
    this.messageCount = 0;
  }

  connect() {
    console.log(`🔗 Connecting to ${this.url}...`);

    this.ws = new WebSocket(this.url);

    this.ws.on("open", () => {
      console.log("✅ Connected to WebSocket server");
      this.registerDevice();
      this.startSendingData();
    });

    this.ws.on("message", (data) => {
      try {
        const message = JSON.parse(data);
        console.log("📥 Received:", message);
      } catch (error) {
        console.log("📥 Received (raw):", data.toString());
      }
    });

    this.ws.on("close", (code, reason) => {
      console.log(`❌ Connection closed: ${code} - ${reason}`);
    });

    this.ws.on("error", (error) => {
      console.error("💥 Connection error:", error.message);
    });
  }

  registerDevice() {
    const message = {
      type: "device_register",
      deviceId: this.deviceId,
      timestamp: Date.now(),
    };

    console.log("📤 Registering device:", this.deviceId);
    this.ws.send(JSON.stringify(message));
  }

  startSendingData() {
    // 1초마다 센서 데이터 전송
    setInterval(() => {
      this.sendSensorData();
    }, 1000);
  }

  sendSensorData() {
    const sensorTypes = [
      "accelerometer",
      "gyroscope",
      "gps",
      "temperature",
      "battery",
    ];
    const sensorType =
      sensorTypes[Math.floor(Math.random() * sensorTypes.length)];

    let value;
    switch (sensorType) {
      case "accelerometer":
      case "gyroscope":
        value = {
          x: (Math.random() - 0.5) * 20,
          y: (Math.random() - 0.5) * 20,
          z: (Math.random() - 0.5) * 20,
        };
        break;
      case "gps":
        value = {
          latitude: 37.5665 + (Math.random() - 0.5) * 0.01,
          longitude: 126.978 + (Math.random() - 0.5) * 0.01,
          altitude: 45 + Math.random() * 10,
        };
        break;
      case "temperature":
        value = {
          celsius: 20 + Math.random() * 15,
        };
        break;
      case "battery":
        value = {
          level: Math.floor(Math.random() * 100),
          isCharging: Math.random() > 0.5,
        };
        break;
    }

    const message = {
      type: "sensor_data",
      deviceId: this.deviceId,
      sensorType: sensorType,
      value: value,
      timestamp: Date.now(),
    };

    this.messageCount++;
    console.log(`📤 Sending [${this.messageCount}] ${sensorType}:`, value);
    this.ws.send(JSON.stringify(message));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// 직접 실행 시 테스트 시작
if (require.main === module) {
  const client = new TestClient();

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑 Disconnecting...");
    client.disconnect();
    process.exit(0);
  });

  client.connect();

  // 30초 후 자동 종료
  setTimeout(() => {
    console.log("\n⏰ Test completed, disconnecting...");
    client.disconnect();
    process.exit(0);
  }, 30000);
}

module.exports = TestClient;
