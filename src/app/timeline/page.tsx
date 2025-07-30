"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, List, Download, Calendar } from "lucide-react";
import { useState } from "react";

export default function TimelinePage() {
  const [viewMode, setViewMode] = useState<"list" | "graph">("list");
  const [selectedAMR, setSelectedAMR] = useState<string>("all");

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">타임라인</h2>
        <p className="text-muted-foreground">
          수집된 센서 데이터를 시간순으로 확인하고 분석합니다.
        </p>
      </div>

      {/* 컨트롤 바 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* 필터 컨트롤 */}
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <Select value={selectedAMR} onValueChange={setSelectedAMR}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="AMR 장비 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 AMR</SelectItem>
                  <SelectItem value="amr1">AMR-001</SelectItem>
                  <SelectItem value="amr2">AMR-002</SelectItem>
                  <SelectItem value="amr3">AMR-003</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  최근 24시간
                </span>
              </div>
            </div>

            {/* 뷰 모드 전환 및 다운로드 */}
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border p-1">
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="gap-2"
                >
                  <List className="h-4 w-4" />
                  리스트
                </Button>
                <Button
                  variant={viewMode === "graph" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("graph")}
                  className="gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  그래프
                </Button>
              </div>

              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                다운로드
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 타임라인 뷰 */}
      <Card>
        <CardHeader>
          <CardTitle>센서 데이터 타임라인</CardTitle>
          <CardDescription>
            {viewMode === "list" ? "시간순 데이터 목록" : "시계열 그래프 분석"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {viewMode === "list" ? (
            <div className="space-y-4">
              {/* 데이터가 없을 때 표시 */}
              <div className="text-center py-12">
                <div className="text-muted-foreground">
                  <p className="text-lg mb-2">데이터가 없습니다</p>
                  <p className="text-sm">
                    스마트폰이 AMR에 거치되고 데이터 수집이 시작되면 여기에
                    표시됩니다.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[400px] flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
              <div className="text-center text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-2" />
                <p>그래프 준비 중...</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 데이터 요약 통계 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">총 레코드</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">전체 데이터 포인트</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">활성 AMR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">데이터 수신 중</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">평균 샘플링</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 Hz</div>
            <p className="text-xs text-muted-foreground">초당 데이터</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">데이터 크기</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 MB</div>
            <p className="text-xs text-muted-foreground">저장된 용량</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
