const winston = require("winston");
const { validateSensorData } = require("../shared/utils/validator");

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [new winston.transports.Console()],
});

/**
 * 센서 데이터 In-Memory 큐 관리 클래스
 * - 최대 1000개 레코드 또는 5초마다 플러시
 * - 유실률 < 0.5% 목표
 */
class DataQueue {
  constructor(databaseManager, options = {}) {
    this.db = databaseManager;
    this.queue = [];
    this.maxBatchSize = options.maxBatchSize || 1000;
    this.flushInterval = options.flushInterval || 5000; // 5초
    this.isProcessing = false;

    // 통계 추적
    this.stats = {
      totalReceived: 0,
      totalProcessed: 0,
      totalFailed: 0,
      batchCount: 0,
    };

    // 주기적 플러시 스케줄러
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);

    logger.info(
      `DataQueue initialized: maxBatch=${this.maxBatchSize}, flushInterval=${this.flushInterval}ms`
    );
  }

  /**
   * 센서 데이터를 큐에 추가
   * @param {Object} sensorData - 센서 데이터 객체
   * @returns {boolean} 성공 여부
   */
  enqueue(sensorData) {
    try {
      // 데이터 검증
      if (!this.validateData(sensorData)) {
        this.stats.totalFailed++;
        logger.warn("Invalid sensor data rejected:", sensorData);
        return false;
      }

      // 큐에 추가
      this.queue.push({
        deviceId: sensorData.deviceId,
        timestamp: sensorData.timestamp,
        sensorType: sensorData.sensorType,
        value: sensorData.value,
        enqueuedAt: Date.now(),
      });

      this.stats.totalReceived++;

      // 큐가 가득 찬 경우 즉시 플러시
      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
      }

      return true;
    } catch (error) {
      logger.error("Enqueue failed:", error);
      this.stats.totalFailed++;
      return false;
    }
  }

  /**
   * 데이터 검증
   * @private
   */
  validateData(data) {
    // 기본 필드 검증
    if (!data || typeof data !== "object") return false;
    if (!data.deviceId || typeof data.deviceId !== "string") return false;
    if (!data.timestamp || typeof data.timestamp !== "number") return false;
    if (!data.sensorType || typeof data.sensorType !== "string") return false;
    if (!data.value || typeof data.value !== "object") return false;

    // shared/utils/validator를 사용한 상세 검증
    return validateSensorData(data);
  }

  /**
   * 큐 플러시 (배치 처리)
   */
  async flush() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // 현재 큐의 모든 데이터를 가져오고 큐 비우기
      const batchData = this.queue.splice(0);

      if (batchData.length === 0) {
        this.isProcessing = false;
        return;
      }

      logger.info(`Flushing batch: ${batchData.length} records`);

      // 데이터베이스에 배치 삽입
      const result = this.db.insertBatch(batchData);

      if (result.success) {
        this.stats.totalProcessed += result.insertedCount;
        this.stats.batchCount++;

        logger.info(
          `Batch processed successfully: ${result.insertedCount}/${result.totalCount} records`
        );

        // 유실률 계산 및 경고
        const lossRate =
          ((result.totalCount - result.insertedCount) / result.totalCount) *
          100;
        if (lossRate > 0.5) {
          logger.warn(`High loss rate detected: ${lossRate.toFixed(2)}%`);
        }
      } else {
        logger.error("Batch processing failed:", result.error);
        this.stats.totalFailed += batchData.length;

        // 실패한 데이터를 큐 앞쪽에 다시 추가 (재시도)
        this.queue.unshift(...batchData);
      }
    } catch (error) {
      logger.error("Flush operation failed:", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 큐 통계 조회
   */
  getStats() {
    const lossRate =
      this.stats.totalReceived > 0
        ? (this.stats.totalFailed / this.stats.totalReceived) * 100
        : 0;

    return {
      ...this.stats,
      currentQueueSize: this.queue.length,
      lossRate: lossRate.toFixed(2),
      isProcessing: this.isProcessing,
    };
  }

  /**
   * 수동 플러시
   */
  forceFlush() {
    return this.flush();
  }

  /**
   * 큐 정리 및 종료
   */
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // 남은 데이터 플러시
    if (this.queue.length > 0) {
      logger.info("Flushing remaining data before shutdown...");
      this.flush();
    }

    logger.info("DataQueue destroyed");
  }
}

module.exports = DataQueue;
