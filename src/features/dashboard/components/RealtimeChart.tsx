"use client";

import { useEffect, useRef, useState } from "react";
import { Chart, ChartConfiguration, ChartType, registerables } from "chart.js";

// Chart.js 등록
Chart.register(...registerables);

interface RealtimeChartProps {
  data: number[];
  label: string;
  color?: string;
  height?: number;
  maxDataPoints?: number;
}

export function RealtimeChart({
  data,
  label,
  color = "rgb(59, 130, 246)", // blue-500
  height = 100,
  maxDataPoints = 20,
}: RealtimeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [chartData, setChartData] = useState<number[]>([]);

  // 데이터 업데이트
  useEffect(() => {
    setChartData((prev) => {
      const newData = [...prev, ...data].slice(-maxDataPoints);
      return newData;
    });
  }, [data, maxDataPoints]);

  // 차트 초기화
  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    // 기존 차트 제거
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const config: ChartConfiguration = {
      type: "line" as ChartType,
      data: {
        labels: Array(maxDataPoints)
          .fill("")
          .map((_, i) => i.toString()),
        datasets: [
          {
            label,
            data: chartData,
            borderColor: color,
            backgroundColor: color + "20", // 투명도 추가
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 0, // 애니메이션 비활성화 (실시간 업데이트를 위해)
        },
        interaction: {
          intersect: false,
          mode: "index",
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: true,
            callbacks: {
              title: () => "",
              label: (context) => `${label}: ${context.parsed.y.toFixed(1)}`,
            },
          },
        },
        scales: {
          x: {
            display: false,
          },
          y: {
            display: true,
            beginAtZero: true,
            grid: {
              display: true,
              color: "rgba(0, 0, 0, 0.05)",
            },
            ticks: {
              display: true,
              font: {
                size: 10,
              },
              color: "rgba(0, 0, 0, 0.5)",
              maxTicksLimit: 4,
            },
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
  }, [label, color, maxDataPoints, height]);

  // 차트 데이터 업데이트
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.data.datasets[0].data = chartData;
      chartRef.current.update("none"); // 애니메이션 없이 업데이트
    }
  }, [chartData]);

  return (
    <div style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
