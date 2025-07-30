"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity, Database, Smartphone, Timer } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">대시보드</h2>
        <p className="text-muted-foreground">
          AMR QC 솔루션의 실시간 상태를 모니터링합니다.
        </p>
      </div>

      {/* 상태 카드 그리드 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              연결된 스마트폰
            </CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">현재 활성 연결</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">수집된 데이터</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">총 레코드 수</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">실시간 처리율</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">패킷/초</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              서버 가동 시간
            </CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0h 0m</div>
            <p className="text-xs text-muted-foreground">시작 시간: -</p>
          </CardContent>
        </Card>
      </div>

      {/* 빠른 시작 가이드 */}
      <Card>
        <CardHeader>
          <CardTitle>빠른 시작 가이드</CardTitle>
          <CardDescription>
            AMR QC 솔루션을 시작하기 위한 단계별 안내입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">1. 서버 연결 확인</h4>
            <p className="text-sm text-muted-foreground">
              서버 연결 페이지에서 QR 코드를 확인하고 스마트폰에서 스캔하세요.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">2. AMR 장비 식별</h4>
            <p className="text-sm text-muted-foreground">
              테스트할 AMR 장비의 QR 코드를 스마트폰으로 스캔하여 AMR ID를
              등록합니다.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium">3. 데이터 모니터링</h4>
            <p className="text-sm text-muted-foreground">
              스마트폰을 AMR에 거치하면 센서 데이터가 자동으로 수집되며,
              타임라인 페이지에서 실시간으로 확인할 수 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
