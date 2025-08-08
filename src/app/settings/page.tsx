"use client";

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Server, Info, Monitor, Shield } from "lucide-react";

// 간단한 로컬 스토리지 유틸
const loadBoolean = (key: string, defaultValue: boolean) => {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === "true";
  } catch {
    return defaultValue;
  }
};

const saveBoolean = (key: string, value: boolean) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {}
};

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  const [autoStart, setAutoStart] = useState<boolean>(true);
  const [showNotifications, setShowNotifications] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [corsEnabled, setCorsEnabled] = useState<boolean>(true);
  const [loggingEnabled, setLoggingEnabled] = useState<boolean>(true);

  useEffect(() => {
    setAutoStart(loadBoolean("settings.autoStart", true));
    setShowNotifications(loadBoolean("settings.showNotifications", true));
    setAutoRefresh(loadBoolean("settings.autoRefresh", true));
    setCorsEnabled(loadBoolean("settings.corsEnabled", true));
    setLoggingEnabled(loadBoolean("settings.loggingEnabled", true));
  }, []);

  const themeLabel = useMemo(() => {
    if (theme === "light") return "밝은 테마";
    if (theme === "dark") return "어두운 테마";
    return "시스템 설정";
  }, [theme]);

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">설정</h2>
        <p className="text-muted-foreground">
          AMR QC 솔루션의 시스템 설정을 관리합니다.
        </p>
      </div>

      {/* 서버 설정 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            <CardTitle>서버 설정</CardTitle>
          </div>
          <CardDescription>
            서버 연결 및 네트워크 설정을 구성합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="server-port">서버 포트</Label>
              <Input
                id="server-port"
                type="number"
                placeholder="8000"
                defaultValue="8000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ws-port">WebSocket 포트</Label>
              <Input
                id="ws-port"
                type="number"
                placeholder="8001"
                defaultValue="8001"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>자동 시작</Label>
              <p className="text-sm text-muted-foreground">
                시스템 시작 시 서버 자동 실행
              </p>
            </div>
            <Switch
              checked={autoStart}
              onCheckedChange={(v) => {
                setAutoStart(v);
                saveBoolean("settings.autoStart", v);
              }}
            />
          </div>

          <Separator />
        </CardContent>
      </Card>

      {/* 일반 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            <CardTitle>일반</CardTitle>
          </div>
          <CardDescription>
            AMR QC 솔루션의 표시 및 동작 설정을 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="theme">테마 설정</Label>
              <Select
                value={theme === undefined ? "system" : (theme as string)}
                onValueChange={(v) =>
                  setTheme(v as "light" | "dark" | "system")
                }
              >
                <SelectTrigger id="theme">
                  <SelectValue placeholder={themeLabel} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">밝은 테마</SelectItem>
                  <SelectItem value="dark">어두운 테마</SelectItem>
                  <SelectItem value="system">시스템 설정</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">즉시 적용됩니다.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">언어 설정</Label>
              <Input
                id="language"
                defaultValue="한국어 (Korean)"
                readOnly
                className="bg-muted"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>알림 표시</Label>
              <p className="text-sm text-muted-foreground">
                시스템 알림 및 토스트 메시지 표시
              </p>
            </div>
            <Switch
              checked={showNotifications}
              onCheckedChange={(v) => {
                setShowNotifications(v);
                saveBoolean("settings.showNotifications", v);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>자동 새로고침</Label>
              <p className="text-sm text-muted-foreground">
                실시간 데이터 자동 갱신 (5초 간격)
              </p>
            </div>
            <Switch
              checked={autoRefresh}
              onCheckedChange={(v) => {
                setAutoRefresh(v);
                saveBoolean("settings.autoRefresh", v);
              }}
            />
          </div>

          <Separator />
        </CardContent>
      </Card>

      {/* 보안 설정 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>보안 설정</CardTitle>
          </div>
          <CardDescription>
            시스템 보안 및 접근 제어 설정입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>CORS 허용</Label>
              <p className="text-sm text-muted-foreground">
                외부 도메인에서의 API 접근 허용
              </p>
            </div>
            <Switch
              checked={corsEnabled}
              onCheckedChange={(v) => {
                setCorsEnabled(v);
                saveBoolean("settings.corsEnabled", v);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>로그 기록</Label>
              <p className="text-sm text-muted-foreground">
                시스템 활동 로그 파일 생성
              </p>
            </div>
            <Switch
              checked={loggingEnabled}
              onCheckedChange={(v) => {
                setLoggingEnabled(v);
                saveBoolean("settings.loggingEnabled", v);
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-connections">최대 동시 연결 수</Label>
            <Input
              id="max-connections"
              type="number"
              placeholder="10"
              defaultValue="10"
              min="1"
              max="50"
            />
            <p className="text-xs text-muted-foreground">
              동시에 연결 가능한 스마트폰 최대 개수
            </p>
          </div>

          <Separator />
        </CardContent>
      </Card>

      {/* 시스템 정보 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            <CardTitle>시스템 정보</CardTitle>
          </div>
          <CardDescription>
            AMR QC 솔루션의 버전 및 시스템 정보입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-muted-foreground">
                버전
              </dt>
              <dd className="text-sm">1.0.0</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-muted-foreground">
                Node.js 버전
              </dt>
              <dd className="text-sm">v20.11.0</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-muted-foreground">
                플랫폼
              </dt>
              <dd className="text-sm">Windows 10</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-muted-foreground">
                메모리 사용량
              </dt>
              <dd className="text-sm">256 MB / 16 GB</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-muted-foreground">
                CPU 사용률
              </dt>
              <dd className="text-sm">5%</dd>
            </div>
          </dl>

          <Separator className="my-4" />

          <div className="text-sm text-muted-foreground">
            <p>© 2024 AMR QC Solution. All rights reserved.</p>
            <p className="mt-1">
              문의: support@amrqc.com | 문서: docs.amrqc.com
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
