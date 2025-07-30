"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Server, Database, Info, Save, RotateCcw } from "lucide-react";

export default function SettingsPage() {
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
            <Checkbox defaultChecked />
          </div>

          <Separator />

          <div className="flex justify-end">
            <Button className="gap-2">
              <Save className="h-4 w-4" />
              서버 설정 저장
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 데이터 관리 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <CardTitle>데이터 관리</CardTitle>
          </div>
          <CardDescription>
            저장된 센서 데이터를 관리하고 정리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>데이터베이스 크기</Label>
              <div className="flex items-center gap-2">
                <Input value="0 MB" readOnly className="flex-1" />
                <Button variant="outline" size="sm">
                  새로고침
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>보관 기간</Label>
              <Input type="number" placeholder="30" defaultValue="30" min="1" />
              <p className="text-xs text-muted-foreground">
                설정된 기간 이후 데이터는 자동 삭제됩니다.
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">데이터 내보내기</h4>
                <p className="text-sm text-muted-foreground">
                  전체 데이터를 CSV 형식으로 내보냅니다.
                </p>
              </div>
              <Button variant="outline">내보내기</Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">데이터 초기화</h4>
                <p className="text-sm text-muted-foreground text-red-500">
                  모든 센서 데이터가 삭제됩니다.
                </p>
              </div>
              <Button variant="destructive" className="gap-2">
                <RotateCcw className="h-4 w-4" />
                초기화
              </Button>
            </div>
          </div>
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
