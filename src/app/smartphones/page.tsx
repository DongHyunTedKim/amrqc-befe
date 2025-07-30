"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Plus,
  Signal,
  Battery,
  Clock,
  ScanLine,
} from "lucide-react";

export default function SmartphonesPage() {
  // 임시 스마트폰 데이터
  const smartphones = [];

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">스마트폰 관리</h2>
          <p className="text-muted-foreground">
            센서 데이터를 수집하는 스마트폰을 관리합니다.
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          스마트폰 연결
        </Button>
      </div>

      {/* 스마트폰 목록 */}
      {smartphones.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              연결된 스마트폰이 없습니다
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              서버 연결 페이지의 QR 코드를 스마트폰으로 스캔하여 연결하세요.
            </p>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />첫 스마트폰 연결
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* 스마트폰 카드 예시 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">스마트폰 #1</CardTitle>
                <Badge variant="default">활성</Badge>
              </div>
              <CardDescription>
                <div className="flex items-center gap-2">
                  <ScanLine className="h-4 w-4" />
                  <span>AMR-001에 거치됨</span>
                </div>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Signal className="h-4 w-4 text-green-500" />
                  <span>신호 강도</span>
                </div>
                <span className="font-medium">우수</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Battery className="h-4 w-4 text-green-500" />
                  <span>배터리</span>
                </div>
                <span className="font-medium">85%</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>마지막 데이터</span>
                </div>
                <span className="font-medium">방금 전</span>
              </div>

              <div className="pt-2 space-y-1 border-t">
                <div className="text-xs text-muted-foreground">
                  모델: Galaxy S23
                </div>
                <div className="text-xs text-muted-foreground">
                  센서: 가속도계, 자이로스코프, GPS
                </div>
                <div className="text-xs text-muted-foreground">
                  샘플링: 100Hz
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 스마트폰 통계 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">전체 스마트폰</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">등록된 기기</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">활성 연결</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">데이터 전송 중</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">AMR 거치됨</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">측정 중인 AMR</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">평균 가동률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground">최근 24시간</p>
          </CardContent>
        </Card>
      </div>

      {/* 스마트폰-AMR 관계 설명 */}
      <Card>
        <CardHeader>
          <CardTitle>스마트폰과 AMR의 관계</CardTitle>
          <CardDescription>
            스마트폰이 AMR 장비에 거치되어 센서 데이터를 수집하는 과정입니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>스마트폰에서 AMR QC 앱을 실행하고 서버에 연결합니다.</li>
            <li>테스트할 AMR 장비의 QR 코드를 스캔하여 AMR ID를 식별합니다.</li>
            <li>
              스마트폰을 해당 AMR에 거치하면 센서 데이터 수집이 시작됩니다.
            </li>
            <li>수집된 데이터는 실시간으로 서버에 전송됩니다.</li>
            <li>
              하나의 스마트폰은 여러 AMR을 순차적으로 테스트할 수 있습니다.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
