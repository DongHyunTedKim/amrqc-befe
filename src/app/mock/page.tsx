"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Wifi, WifiOff, Play, Pause, Trash2, Plus } from "lucide-react";

interface MockDevice {
  id: string;
  deviceId: string;
  ws: WebSocket | null;
  connected: boolean;
  sending: boolean;
  sensorTypes: string[];
  interval: number;
  intervalId?: NodeJS.Timeout;
}

export default function MockPage() {
  const [mockDevices, setMockDevices] = useState<MockDevice[]>([]);
  const [serverUrl, setServerUrl] = useState("ws://localhost:8001");
  const [newDeviceId, setNewDeviceId] = useState("");

  const { toast } = useToast();

  // localStorage에서 Mock 디바이스 목록 복원
  useEffect(() => {
    const savedDevices = localStorage.getItem("mockDevices");
    if (savedDevices) {
      try {
        const parsedDevices = JSON.parse(savedDevices);
        // 연결 상태는 복원하지 않고 기본값으로 설정
        const devicesWithDefaultState = parsedDevices.map(
          (device: MockDevice) => ({
            ...device,
            ws: null,
            connected: false,
            sending: false,
            intervalId: undefined,
          })
        );
        setMockDevices(devicesWithDefaultState);
      } catch (error) {
        console.error("Mock 디바이스 목록 복원 실패:", error);
      }
    }
  }, []);

  // Mock 디바이스 목록이 변경될 때마다 localStorage에 저장
  useEffect(() => {
    if (mockDevices.length > 0 || localStorage.getItem("mockDevices")) {
      // 저장 시에는 연결 상태 정보를 제외하고 저장
      const devicesToSave = mockDevices.map(
        ({ ws, intervalId, ...device }) => device
      );
      localStorage.setItem("mockDevices", JSON.stringify(devicesToSave));
    }
  }, [mockDevices]);

  // 컴포넌트 언마운트 시 모든 연결 정리
  useEffect(() => {
    return () => {
      mockDevices.forEach((device) => {
        if (device.intervalId) window.clearInterval(device.intervalId);
        if (device.ws) device.ws.close();
      });
    };
  }, [mockDevices]);

  const createMockDevice = () => {
    if (!newDeviceId) {
      toast({
        title: "오류",
        description: "Device ID를 입력해주세요",
        variant: "destructive",
      });
      return;
    }

    const device: MockDevice = {
      id: `mock-${Date.now()}`,
      deviceId: newDeviceId,
      ws: null,
      connected: false,
      sending: false,
      sensorTypes: [
        "accelerometer",
        "gyroscope",
        "magnetometer",
        "battery",
        "microphone",
      ],
      interval: 1000,
    };

    setMockDevices([...mockDevices, device]);
    setNewDeviceId("");

    toast({
      title: "Mock 디바이스 생성",
      description: `${device.deviceId} 디바이스가 생성되었습니다`,
    });
  };

  const connectDevice = (device: MockDevice) => {
    try {
      const ws = new WebSocket(serverUrl);

      ws.onopen = () => {
        // Device ID 등록
        ws.send(
          JSON.stringify({
            type: "device_register",
            deviceId: device.deviceId,
          })
        );

        setMockDevices((prev) =>
          prev.map((d) =>
            d.id === device.id ? { ...d, ws, connected: true } : d
          )
        );

        toast({
          title: "연결 성공",
          description: `${device.deviceId} 연결되었습니다`,
        });
      };

      ws.onclose = () => {
        setMockDevices((prev) =>
          prev.map((d) =>
            d.id === device.id
              ? { ...d, ws: null, connected: false, sending: false }
              : d
          )
        );
      };

      ws.onerror = (error) => {
        toast({
          title: "연결 오류",
          description: "WebSocket 연결에 실패했습니다",
          variant: "destructive",
        });
      };
    } catch (error) {
      toast({
        title: "연결 오류",
        description: "WebSocket 생성에 실패했습니다",
        variant: "destructive",
      });
    }
  };

  const disconnectDevice = (device: MockDevice) => {
    if (device.intervalId) window.clearInterval(device.intervalId);
    if (device.ws) device.ws.close();

    setMockDevices((prev) =>
      prev.map((d) =>
        d.id === device.id
          ? { ...d, ws: null, connected: false, sending: false }
          : d
      )
    );
  };

  const startSending = (device: MockDevice) => {
    if (!device.ws || !device.connected) return;

    const intervalId = window.setInterval(() => {
      device.sensorTypes.forEach((sensorType) => {
        const data = generateMockData(sensorType);
        device.ws?.send(
          JSON.stringify({
            type: "sensor_data",
            deviceId: device.deviceId,
            timestamp: Date.now(),
            sensorType,
            value: data,
          })
        );
      });
    }, device.interval) as unknown as NodeJS.Timeout;

    setMockDevices((prev) =>
      prev.map((d) =>
        d.id === device.id ? { ...d, sending: true, intervalId } : d
      )
    );
  };

  const stopSending = (device: MockDevice) => {
    if (device.intervalId) window.clearInterval(device.intervalId);

    setMockDevices((prev) =>
      prev.map((d) =>
        d.id === device.id ? { ...d, sending: false, intervalId: undefined } : d
      )
    );
  };

  const deleteDevice = (device: MockDevice) => {
    if (device.intervalId) window.clearInterval(device.intervalId);
    if (device.ws) device.ws.close();

    setMockDevices((prev) => prev.filter((d) => d.id !== device.id));
  };

  const generateMockData = (sensorType: string) => {
    switch (sensorType) {
      case "accelerometer":
        return {
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
          z: 9.8 + (Math.random() - 0.5) * 0.5,
        };
      case "gyroscope":
        return {
          x: (Math.random() - 0.5) * 0.1,
          y: (Math.random() - 0.5) * 0.1,
          z: (Math.random() - 0.5) * 0.1,
        };
      case "magnetometer":
        return {
          x: 25 + (Math.random() - 0.5) * 10,
          y: -30 + (Math.random() - 0.5) * 10,
          z: 48 + (Math.random() - 0.5) * 10,
        };
      case "battery":
        return {
          level: Math.floor(Math.random() * 100),
          temperature: 25 + Math.random() * 10,
          voltage: 3700 + Math.random() * 300, // mV 단위
        };
      case "temperature":
        return {
          celsius: 20 + Math.random() * 10,
        };
      case "microphone":
        const baseDecibel = 30 + Math.random() * 50; // 30-80 dB 범위
        const maxDecibel = baseDecibel + Math.random() * 20; // 최대값은 더 높게
        return {
          decibel: baseDecibel,
          maxDecibel: maxDecibel,
        };
      default:
        return {};
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mock 디바이스 시뮬레이션</h1>
        <p className="text-muted-foreground mt-2">
          실시간 Mock 디바이스를 생성하고 센서 데이터를 전송합니다
        </p>
      </div>

      {/* 서버 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>서버 설정</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>WebSocket 서버 URL</Label>
              <Input
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="ws://localhost:8001"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 새 디바이스 생성 */}
      <Card>
        <CardHeader>
          <CardTitle>새 Mock 디바이스 생성</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Device ID</Label>
              <Input
                value={newDeviceId}
                onChange={(e) => setNewDeviceId(e.target.value)}
                placeholder="MOCK-001"
              />
            </div>
            <Button onClick={createMockDevice} className="self-end">
              <Plus className="w-4 h-4 mr-2" />
              생성
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Mock 디바이스 목록 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Mock 디바이스 목록</h2>

        {mockDevices.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-muted-foreground">
              생성된 Mock 디바이스가 없습니다
            </CardContent>
          </Card>
        ) : (
          mockDevices.map((device) => (
            <Card key={device.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{device.deviceId}</h3>
                      <Badge
                        variant={device.connected ? "default" : "secondary"}
                      >
                        {device.connected ? "연결됨" : "연결 안됨"}
                      </Badge>
                      {device.sending && (
                        <Badge variant="default" className="bg-green-500">
                          전송 중
                        </Badge>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {!device.connected ? (
                        <Button size="sm" onClick={() => connectDevice(device)}>
                          <Wifi className="w-4 h-4 mr-2" />
                          연결
                        </Button>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => disconnectDevice(device)}
                          >
                            <WifiOff className="w-4 h-4 mr-2" />
                            연결 해제
                          </Button>

                          {!device.sending ? (
                            <Button
                              size="sm"
                              onClick={() => startSending(device)}
                            >
                              <Play className="w-4 h-4 mr-2" />
                              전송 시작
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => stopSending(device)}
                            >
                              <Pause className="w-4 h-4 mr-2" />
                              전송 중지
                            </Button>
                          )}
                        </>
                      )}

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteDevice(device)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    <div>센서: {device.sensorTypes.join(", ")}</div>
                    <div>주기: {device.interval}ms</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
