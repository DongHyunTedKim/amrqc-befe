"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Chart,
  ChartConfiguration,
  ChartType,
  registerables,
  TooltipItem,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { format } from "date-fns";

// Chart.js 플러그인 등록
Chart.register(...registerables, zoomPlugin);

interface SensorData {
  id: number;
  deviceId: string;
  timestamp: number;
  sensorType: string;
  value: any;
  createdAt: string;
}

interface MonitoringChartProps {
  data: SensorData[];
  sensorTypes: string[];
  onRangeSelect?: (start: number, end: number) => void;
  height?: number;
}

// 센서 타입별 색상 매핑
const SENSOR_COLORS: Record<string, string> = {
  accelerometer: "rgb(59, 130, 246)", // blue
  gyroscope: "rgb(34, 197, 94)", // green
  gps: "rgb(251, 191, 36)", // yellow
  temperature: "rgb(239, 68, 68)", // red
  battery: "rgb(168, 85, 247)", // purple
  magnetometer: "rgb(99, 102, 241)", // indigo
  microphone: "rgb(245, 101, 101)", // coral/orange-red
};

export function MonitoringChart({
  data,
  sensorTypes,
  onRangeSelect,
  height = 400,
}: MonitoringChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [selectedRange, setSelectedRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

  // 데이터를 차트 형식으로 변환
  const prepareChartData = useCallback(() => {
    if (!data || data.length === 0) {
      return { labels: [], datasets: [] };
    }

    // 타임스탬프 기준으로 정렬
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp);

    // 유니크한 타임스탬프 추출
    const timestamps = [...new Set(sortedData.map((d) => d.timestamp))].sort();

    // 센서 타입별 데이터셋 생성
    const datasets = sensorTypes.map((sensorType) => {
      const sensorData = sortedData.filter((d) => d.sensorType === sensorType);

      // 타임스탬프별 값 매핑
      const values = timestamps.map((ts) => {
        const item = sensorData.find((d) => d.timestamp === ts);
        if (!item) return null;

        // 센서 타입별 값 추출
        switch (sensorType) {
          case "accelerometer":
          case "gyroscope":
          case "magnetometer":
            // 3축 센서의 경우 크기(magnitude) 계산
            const { x = 0, y = 0, z = 0 } = item.value;
            return Math.sqrt(x * x + y * y + z * z);
          case "temperature":
            return item.value.celsius || item.value.value || 0;
          case "battery":
            return item.value.level || 0;
          case "microphone":
            return item.value.decibel || 0;
          case "gps":
            // GPS는 속도나 고도 등을 표시할 수 있음
            return item.value.speed || 0;
          default:
            return typeof item.value === "number" ? item.value : 0;
        }
      });

      return {
        label: sensorType,
        data: values,
        borderColor: SENSOR_COLORS[sensorType] || "rgb(156, 163, 175)",
        backgroundColor:
          (SENSOR_COLORS[sensorType] || "rgb(156, 163, 175)") + "20",
        borderWidth: 2,
        fill: false,
        tension: 0.1,
        pointRadius: 2,
        pointHoverRadius: 5,
        spanGaps: true, // null 값을 건너뛰고 선 연결
      };
    });

    return {
      labels: timestamps,
      datasets,
    };
  }, [data, sensorTypes]);

  // 차트 초기화 및 업데이트
  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const chartData = prepareChartData();

    // 차트가 이미 존재하면 데이터만 업데이트
    if (chartRef.current) {
      chartRef.current.data = chartData;
      chartRef.current.update("none"); // 애니메이션 없이 업데이트
      return;
    }

    const config: ChartConfiguration = {
      type: "line" as ChartType,
      data: chartData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0, // 애니메이션 비활성화 (실시간 업데이트를 위해)
        },
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
          },
          tooltip: {
            enabled: true,
            callbacks: {
              title: (tooltipItems) => {
                if (tooltipItems.length > 0) {
                  const timestamp = tooltipItems[0].parsed.x;
                  return format(new Date(timestamp), "yyyy-MM-dd HH:mm:ss");
                }
                return "";
              },
              label: (context: TooltipItem<"line">) => {
                const label = context.dataset.label || "";
                const value = context.parsed.y;

                // 센서 타입별 단위 추가
                let unit = "";
                switch (label) {
                  case "accelerometer":
                  case "gyroscope":
                  case "magnetometer":
                    unit = " m/s²";
                    break;
                  case "temperature":
                    unit = " °C";
                    break;
                  case "battery":
                    unit = " %";
                    break;
                  case "gps":
                    unit = " m/s";
                    break;
                }

                return `${label}: ${value?.toFixed(2)}${unit}`;
              },
            },
          },
          zoom: {
            pan: {
              enabled: true,
              mode: "x",
            },
            zoom: {
              wheel: {
                enabled: true,
              },
              pinch: {
                enabled: true,
              },
              mode: "x",
              onZoomComplete: ({ chart }) => {
                const { min, max } = chart.scales.x;
                if (
                  onRangeSelect &&
                  typeof min === "number" &&
                  typeof max === "number"
                ) {
                  setSelectedRange({ start: min, end: max });
                  onRangeSelect(min, max);
                }
              },
            },
            limits: {
              x: {
                min: "original",
                max: "original",
              },
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            display: true,
            title: {
              display: true,
              text: "시간",
            },
            ticks: {
              callback: (value) => {
                return format(new Date(value), "HH:mm:ss");
              },
              maxTicksLimit: 10,
            },
          },
          y: {
            display: true,
            title: {
              display: true,
              text: "값",
            },
            beginAtZero: true,
          },
        },
      },
    };

    chartRef.current = new Chart(ctx, config);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [sensorTypes, onRangeSelect]); // data 의존성 제거하여 데이터 변경시 재생성 방지

  // 데이터만 변경될 때 차트 업데이트
  useEffect(() => {
    if (chartRef.current) {
      const chartData = prepareChartData();
      chartRef.current.data = chartData;
      chartRef.current.update("none"); // 애니메이션 없이 업데이트
    }
  }, [data, prepareChartData]);

  // 차트 리셋 버튼
  const handleResetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
      setSelectedRange(null);
      if (onRangeSelect) {
        const chartData = prepareChartData();
        if (chartData.labels.length > 0) {
          const start = chartData.labels[0] as number;
          const end = chartData.labels[chartData.labels.length - 1] as number;
          onRangeSelect(start, end);
        }
      }
    }
  };

  return (
    <div className="relative">
      {/* 차트 컨트롤 */}
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={handleResetZoom}
          className="px-3 py-1 text-sm bg-white border rounded-md shadow-sm hover:bg-gray-50"
        >
          전체 보기
        </button>
      </div>

      {/* 선택된 구간 표시 */}
      {selectedRange && (
        <div className="absolute top-2 left-2 z-10 bg-white px-3 py-1 rounded-md shadow-sm text-sm">
          <span className="font-medium">선택 구간: </span>
          {format(new Date(selectedRange.start), "HH:mm:ss")} ~{" "}
          {format(new Date(selectedRange.end), "HH:mm:ss")}
        </div>
      )}

      {/* 차트 캔버스 */}
      <div style={{ height: `${height}px` }}>
        <canvas ref={canvasRef} />
      </div>

      {/* 사용 안내 */}
      <div className="mt-2 text-xs text-muted-foreground text-center">
        마우스 휠로 확대/축소, 드래그로 이동할 수 있습니다
      </div>
    </div>
  );
}
