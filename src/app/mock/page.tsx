"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
// 탭 컴포넌트가 없으므로 간단한 로컬 탭 상태로 구현
import { useToast } from "@/hooks/use-toast";
import {
  Wifi,
  WifiOff,
  Play,
  Pause,
  Trash2,
  Plus,
  CheckCircle,
  Loader2,
} from "lucide-react";

interface MockDevice {
  id: string;
  deviceId: string;
  ws: WebSocket | null;
  connected: boolean;
  connecting: boolean; // 연결 중 상태 추가
  sending: boolean;
  sensorTypes: string[];
  interval: number;
  intervalId?: NodeJS.Timeout;
  sensorIntervals: Record<string, number>;
  intervalIdsBySensor?: Record<string, NodeJS.Timeout>;
  sessionId?: string; // 세션 ID 추가
  lastMessage?: string; // 마지막 수신 메시지
}

export default function MockPage() {
  const [mockDevices, setMockDevices] = useState<MockDevice[]>([]);
  const [newDeviceId, setNewDeviceId] = useState("");
  const [minutes, setMinutes] = useState("10");
  const [interval, setInterval] = useState("1000");
  const [deviceCount, setDeviceCount] = useState("3");
  const [generating, setGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"bulk" | "devices">("bulk");

  const { toast } = useToast();

  // localStorage에서 Mock 디바이스 목록 복원
  useEffect(() => {
    const savedDevices = localStorage.getItem("mockDevices");
    if (savedDevices) {
      try {
        const parsedDevices = JSON.parse(savedDevices);
        // 연결 상태는 복원하지 않고 기본값으로 설정
        const devicesWithDefaultState = parsedDevices.map((device: any) => ({
          ...device,
          ws: null,
          connected: false,
          connecting: false,
          sending: false,
          intervalId: undefined,
          intervalIdsBySensor: undefined,
          sensorIntervals: device.sensorIntervals || {
            accelerometer: 1000,
            gyroscope: 1000,
            magnetometer: 1000,
            battery: 1000,
            microphone: 1000,
            temperature: 1000,
          },
        }));
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
        ({
          ws,
          intervalId,
          intervalIdsBySensor,
          connected,
          connecting,
          sending,
          ...device
        }) => device
      );
      localStorage.setItem("mockDevices", JSON.stringify(devicesToSave));
    }
  }, [mockDevices]);

  // 컴포넌트 언마운트 시에만 모든 연결 정리 (dependency 배열 제거)
  useEffect(() => {
    return () => {
      console.log("Mock 페이지 언마운트 - 모든 WebSocket 연결 정리");
      // 현재 상태의 mockDevices를 참조하지 않고, ref를 통해 최신 상태에 접근
      setMockDevices((currentDevices) => {
        currentDevices.forEach((device) => {
          if (device.intervalId) window.clearInterval(device.intervalId);
          if (device.intervalIdsBySensor) {
            Object.values(device.intervalIdsBySensor).forEach((id) =>
              window.clearInterval(id)
            );
          }
          if (device.ws) {
            console.log(
              `[${device.deviceId}] 언마운트로 인한 WebSocket 연결 종료`
            );
            device.ws.close(1000, "Component unmount");
          }
        });
        return currentDevices; // 상태는 변경하지 않고 cleanup만 수행
      });
    };
  }, []); // 빈 의존성 배열로 컴포넌트 마운트/언마운트 시에만 실행

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
      connecting: false,
      sending: false,
      sensorTypes: [
        "accelerometer",
        "gyroscope",
        "magnetometer",
        "battery",
        "microphone",
      ],
      interval: 1000,
      sensorIntervals: {
        accelerometer: 1000,
        gyroscope: 1000,
        magnetometer: 1000,
        battery: 1000,
        microphone: 1000,
        temperature: 1000,
      },
    };

    setMockDevices([...mockDevices, device]);
    setNewDeviceId("");

    toast({
      title: "Mock 디바이스 생성",
      description: `${device.deviceId} 디바이스가 생성되었습니다`,
    });
  };

  const getDefaultWsUrl = (): string => {
    try {
      const host =
        typeof window !== "undefined" ? window.location.hostname : "localhost";
      return `ws://${host}:8001`;
    } catch {
      return "ws://localhost:8001";
    }
  };

  // 벌크 Mock 데이터 생성 (이관됨)
  const handleGenerateBulkData = async () => {
    setGenerating(true);
    try {
      const response = await fetch("http://localhost:8000/api/mock/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes: parseFloat(minutes), // 분 단위로 직접 전송
          interval: parseInt(interval),
          devices: parseInt(deviceCount),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate data");
      }
      const result = await response.json();
      toast({
        title: "성공",
        description: `${result.details.totalRecords.toLocaleString()}개의 데이터가 생성되었습니다.`,
      });
    } catch (error) {
      toast({
        title: "오류",
        description:
          error instanceof Error
            ? error.message
            : "데이터 생성에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const connectDevice = (device: MockDevice) => {
    // 이미 연결 중이거나 연결된 경우 중복 요청 방지
    if (device.connecting || device.connected) {
      return;
    }

    // 연결 중 상태로 변경
    setMockDevices((prev) =>
      prev.map((d) => (d.id === device.id ? { ...d, connecting: true } : d))
    );

    try {
      const ws = new WebSocket(getDefaultWsUrl());

      ws.onopen = () => {
        console.log(`[${device.deviceId}] WebSocket 연결 열림`);

        // Device ID 등록
        ws.send(
          JSON.stringify({
            type: "device_register",
            deviceId: device.deviceId,
            timestamp: Date.now(),
          })
        );

        console.log(`[${device.deviceId}] device_register 메시지 전송`);

        // WebSocket 객체는 저장하되, 아직 connected = false로 유지
        setMockDevices((prev) =>
          prev.map((d) =>
            d.id === device.id
              ? { ...d, ws, connected: false, connecting: true }
              : d
          )
        );
      };

      // 메시지 수신 처리 추가
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log(`[${device.deviceId}] 받은 메시지:`, message);

          setMockDevices((prev) =>
            prev.map((d) =>
              d.id === device.id
                ? {
                    ...d,
                    lastMessage: message.type,
                    sessionId: message.sessionId || d.sessionId,
                    // device_registered 응답이 오면 연결 상태를 true로, connecting을 false로 변경
                    connected:
                      message.type === "device_registered" ? true : d.connected,
                    connecting:
                      message.type === "device_registered"
                        ? false
                        : d.connecting,
                  }
                : d
            )
          );

          // device_registered 메시지 처리
          if (message.type === "device_registered" && message.sessionId) {
            console.log(
              `[${device.deviceId}] 디바이스 등록 완료, 연결 상태 활성화`
            );
            toast({
              title: "연결 성공",
              description: `${device.deviceId} 등록 완료 (Session: ${message.sessionId})`,
            });
          }
        } catch (error) {
          console.error("메시지 파싱 오류:", error);
        }
      };

      ws.onclose = (event) => {
        console.log(
          `[${device.deviceId}] WebSocket 연결 닫힘, code: ${event.code}, reason: ${event.reason}`
        );

        setMockDevices((prev) =>
          prev.map((d) =>
            d.id === device.id
              ? {
                  ...d,
                  ws: null,
                  connected: false,
                  connecting: false, // 연결 중 상태도 초기화
                  sending: false,
                  intervalId: undefined,
                  intervalIdsBySensor: undefined,
                }
              : d
          )
        );

        // 예기치 않은 연결 끊김인 경우 토스트 알림
        if (event.code !== 1000) {
          toast({
            title: "연결 끊김",
            description: `${device.deviceId} 연결이 끊어졌습니다 (code: ${event.code})`,
            variant: "destructive",
          });
        }
      };

      ws.onerror = (error) => {
        console.error(`[${device.deviceId}] WebSocket 오류:`, error);

        // 오류 발생 시 연결 중 상태 해제
        setMockDevices((prev) =>
          prev.map((d) =>
            d.id === device.id
              ? { ...d, connecting: false, connected: false }
              : d
          )
        );

        toast({
          title: "연결 오류",
          description: "WebSocket 연결에 실패했습니다",
          variant: "destructive",
        });
      };
    } catch (error) {
      // WebSocket 생성 실패 시 연결 중 상태 해제
      setMockDevices((prev) =>
        prev.map((d) =>
          d.id === device.id ? { ...d, connecting: false, connected: false } : d
        )
      );

      toast({
        title: "연결 오류",
        description: "WebSocket 생성에 실패했습니다",
        variant: "destructive",
      });
    }
  };

  const disconnectDevice = (device: MockDevice) => {
    if (device.intervalId) window.clearInterval(device.intervalId);
    if (device.intervalIdsBySensor) {
      Object.values(device.intervalIdsBySensor).forEach((id) =>
        window.clearInterval(id)
      );
    }
    if (device.ws) {
      console.log(`[${device.deviceId}] 사용자 요청으로 WebSocket 연결 종료`);
      device.ws.close(1000, "User requested disconnect");
    }

    setMockDevices((prev) =>
      prev.map((d) =>
        d.id === device.id
          ? {
              ...d,
              ws: null,
              connected: false,
              connecting: false,
              sending: false,
              intervalId: undefined,
              intervalIdsBySensor: undefined,
            }
          : d
      )
    );
  };

  const startSending = (device: MockDevice) => {
    if (!device.ws || !device.connected) return;

    const ids: Record<string, NodeJS.Timeout> = {};
    device.sensorTypes.forEach((sensorType) => {
      const ms = Math.max(
        100,
        device.sensorIntervals?.[sensorType] || device.interval || 1000
      );
      const id = window.setInterval(() => {
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
      }, ms) as unknown as NodeJS.Timeout;
      ids[sensorType] = id;
    });

    setMockDevices((prev) =>
      prev.map((d) =>
        d.id === device.id
          ? { ...d, sending: true, intervalIdsBySensor: ids }
          : d
      )
    );
  };

  const stopSending = (device: MockDevice) => {
    if (device.intervalId) window.clearInterval(device.intervalId);
    if (device.intervalIdsBySensor) {
      Object.values(device.intervalIdsBySensor).forEach((id) =>
        window.clearInterval(id)
      );
    }
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
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mock 데이터</h1>
          <p className="text-muted-foreground mt-2">
            벌크 데이터 생성과 Mock 디바이스 시뮬레이션을 관리합니다
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border p-1">
          <Button
            variant={activeTab === "bulk" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("bulk")}
          >
            벌크 데이터 생성
          </Button>
          <Button
            variant={activeTab === "devices" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("devices")}
          >
            Mock 디바이스 생성
          </Button>
        </div>
      </div>

      {activeTab === "bulk" && (
        <Card>
          <CardHeader>
            <CardTitle>벌크 데이터 생성</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minutes">기간 (분)</Label>
                  <Input
                    id="minutes"
                    type="number"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    min="1"
                    max="1440"
                    step="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="interval">간격 (ms)</Label>
                  <Input
                    id="interval"
                    type="number"
                    value={interval}
                    onChange={(e) => setInterval(e.target.value)}
                    min="100"
                    max="60000"
                    step="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="devices">디바이스 수</Label>
                  <Input
                    id="devices"
                    type="number"
                    value={deviceCount}
                    onChange={(e) => setDeviceCount(e.target.value)}
                    min="1"
                    max="5"
                  />
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                약{" "}
                {Math.floor(
                  ((parseFloat(minutes) * 60 * 1000) / parseInt(interval)) *
                    parseInt(deviceCount) *
                    0.7
                ).toLocaleString()}{" "}
                개의 데이터가 생성됩니다.
              </div>

              <Button
                onClick={handleGenerateBulkData}
                disabled={generating}
                className="w-full"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    벌크 데이터 생성
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 서버 설정 섹션 제거됨 (자동 설정) */}

      {activeTab === "devices" && (
        <>
          {/* 새 디바이스 생성 */}
          <Card>
            <CardHeader>
              <CardTitle>새 Mock 디바이스 생성</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <Label>Device ID</Label>
                  <Input
                    value={newDeviceId}
                    onChange={(e) => setNewDeviceId(e.target.value)}
                    placeholder="MOCK-001"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={createMockDevice} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    생성
                  </Button>
                </div>
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
                    <div className="flex items-start justify-between gap-6">
                      <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{device.deviceId}</h3>
                          <Badge
                            variant={
                              device.connected
                                ? "default"
                                : device.connecting
                                ? "outline"
                                : "secondary"
                            }
                          >
                            {device.connecting
                              ? "연결 중..."
                              : device.connected
                              ? "연결됨"
                              : "연결 안됨"}
                          </Badge>
                          {device.sending && (
                            <Badge variant="default" className="bg-green-500">
                              전송 중
                            </Badge>
                          )}
                          {device.sessionId && (
                            <Badge variant="outline" className="text-xs">
                              Session:{" "}
                              {device.sessionId.split("-").slice(-1)[0]}
                            </Badge>
                          )}
                        </div>

                        {/* 세션 정보 표시 */}
                        {device.sessionId && (
                          <div className="text-xs text-muted-foreground">
                            Session ID: {device.sessionId}
                          </div>
                        )}

                        {/* 마지막 메시지 표시 */}
                        {device.lastMessage && (
                          <div className="text-xs text-muted-foreground">
                            Last message: {device.lastMessage}
                          </div>
                        )}

                        {/* 연결 토글 (Switch) */}
                        <div className="flex items-center gap-3">
                          <Label htmlFor={`conn-${device.id}`}>연결</Label>
                          <div className="flex items-center gap-2">
                            <Switch
                              id={`conn-${device.id}`}
                              checked={device.connected}
                              disabled={device.connecting}
                              onCheckedChange={(checked) => {
                                if (checked) connectDevice(device);
                                else disconnectDevice(device);
                              }}
                            />
                            {device.connecting && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                          </div>
                        </div>

                        {/* 센서 타입 체크박스 */}
                        <div className="space-y-2">
                          <div className="text-sm font-medium">
                            센서 선택 및 생성주기
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[
                              "accelerometer",
                              "gyroscope",
                              "magnetometer",
                              "battery",
                              "microphone",
                              "temperature",
                            ].map((type) => (
                              <div
                                key={type}
                                className="flex items-center justify-between gap-3 border rounded-md p-2"
                              >
                                <label className="flex items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={device.sensorTypes.includes(type)}
                                    onCheckedChange={(checked) => {
                                      setMockDevices((prev) =>
                                        prev.map((d) => {
                                          if (d.id !== device.id) return d;
                                          const nextTypes = checked
                                            ? Array.from(
                                                new Set([
                                                  ...d.sensorTypes,
                                                  type,
                                                ])
                                              )
                                            : d.sensorTypes.filter(
                                                (t) => t !== type
                                              );
                                          return {
                                            ...d,
                                            sensorTypes: nextTypes,
                                          };
                                        })
                                      );
                                    }}
                                  />
                                  <span>{type}</span>
                                </label>
                                <div className="flex items-center gap-2">
                                  <Label
                                    htmlFor={`interval-${device.id}-${type}`}
                                    className="text-xs text-muted-foreground"
                                  >
                                    주기(ms)
                                  </Label>
                                  <Input
                                    id={`interval-${device.id}-${type}`}
                                    type="number"
                                    className="h-8 w-28"
                                    min={100}
                                    step={100}
                                    disabled={
                                      !device.sensorTypes.includes(type)
                                    }
                                    value={
                                      (device as any).sensorIntervals?.[type] ??
                                      device.interval ??
                                      1000
                                    }
                                    onChange={(e) => {
                                      const value = Math.max(
                                        100,
                                        parseInt(e.target.value || "0")
                                      );
                                      setMockDevices((prev) =>
                                        prev.map((d) => {
                                          if (d.id !== device.id) return d;
                                          return {
                                            ...d,
                                            sensorIntervals: {
                                              ...(d as any).sensorIntervals,
                                              [type]: value,
                                            },
                                          } as MockDevice;
                                        })
                                      );
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 전송 컨트롤 */}
                        <div className="flex items-center gap-2">
                          {!device.sending ? (
                            <Button
                              size="sm"
                              onClick={() => startSending(device)}
                              disabled={!device.connected}
                            >
                              <Play className="w-4 h-4 mr-2" /> 전송 시작
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => stopSending(device)}
                            >
                              <Pause className="w-4 h-4 mr-2" /> 전송 중지
                            </Button>
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

                      {/* 우측 요약 블록 제거됨 */}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
