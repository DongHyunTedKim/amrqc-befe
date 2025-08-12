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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Database,
  Clock,
  Activity,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Filter,
  Search,
  Calendar,
  Smartphone,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

// 세션 데이터 타입 정의
interface Session {
  sessionId: string;
  deviceId: string;
  status: "active" | "completed" | "error" | "paused";
  startTime: number;
  endTime?: number | null;
  dataCount: number;
  firstDataTime?: number | null;
  lastDataTime?: number | null;
  createdAt: string;
  updatedAt: string;
}

export default function MonitoringPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState(false);

  // API 기본 URL
  const API_BASE = "http://localhost:8000/api";

  // 세션 목록 조회
  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append("limit", "200");

      if (selectedDevice !== "all") {
        params.append("deviceId", selectedDevice);
      }

      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const response = await fetch(`${API_BASE}/sessions?${params}`);
      if (!response.ok) {
        throw new Error(`API 오류: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setSessions(result.data || []);
      } else {
        throw new Error(result.error || "세션 조회 실패");
      }
    } catch (error) {
      console.error("세션 목록 조회 실패:", error);
      setError(
        error instanceof Error ? error.message : "세션 목록 조회에 실패했습니다"
      );
    } finally {
      setLoading(false);
    }
  }, [selectedDevice, statusFilter]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // 새로고침 핸들러
  const handleRefresh = () => {
    fetchSessions();
  };

  // 선택 토글
  const toggleSelect = (sessionId: string) => {
    setSelectedIds((prev) => ({ ...prev, [sessionId]: !prev[sessionId] }));
  };

  const clearSelection = () => setSelectedIds({});

  const selectedCount = useMemo(
    () => Object.values(selectedIds).filter(Boolean).length,
    [selectedIds]
  );

  // 삭제 API
  const deleteSelected = async () => {
    const ids = Object.entries(selectedIds)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (ids.length === 0) return;
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/sessions/delete-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: ids }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || `삭제 실패: ${res.status}`);
      }
      clearSelection();
      await fetchSessions();
    } catch (e) {
      console.error("세션 삭제 실패", e);
      alert(e instanceof Error ? e.message : "세션 삭제 실패");
    } finally {
      setDeleting(false);
    }
  };

  // 세션 카드 클릭 핸들러
  const handleSessionClick = (sessionId: string) => {
    router.push(`/monitoring/${sessionId}`);
  };

  // 샘플 디바이스 여부 확인
  const isSampleDevice = (deviceId: string) => {
    // AMR-001부터 AMR-005까지와 TEST로 시작하는 디바이스는 샘플로 간주
    return /^AMR-00[1-5]$/.test(deviceId) || deviceId.startsWith("TEST");
  };

  // 디바이스 표시명 생성
  const getDeviceDisplayName = (deviceId: string) => {
    return isSampleDevice(deviceId) ? `${deviceId} (SAMPLE)` : deviceId;
  };

  // 고유 디바이스 목록 추출
  const uniqueDevices = useMemo(() => {
    const devices = new Set(sessions.map((s) => s.deviceId));
    return Array.from(devices).sort();
  }, [sessions]);

  // 필터링된 세션 목록
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      // 검색어 필터
      if (
        searchTerm &&
        !session.deviceId.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !session.sessionId.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [sessions, searchTerm]);

  // 세션 상태별 색상 및 라벨
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return { color: "bg-green-100 text-green-800", label: "수집 중" };
      case "completed":
        return { color: "bg-blue-100 text-blue-800", label: "완료" };
      case "error":
        return { color: "bg-red-100 text-red-800", label: "오류" };
      case "paused":
        return { color: "bg-yellow-100 text-yellow-800", label: "일시정지" };
      default:
        return { color: "bg-gray-100 text-gray-800", label: status };
    }
  };

  // 세션 기간 계산
  const getSessionDuration = (session: Session) => {
    const start = session.startTime;
    const end = session.endTime || Date.now();
    const durationMs = end - start;

    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else if (minutes > 0) {
      return `${minutes}분 ${seconds}초`;
    } else {
      return `${seconds}초`;
    }
  };

  // 데이터 수 포맷팅
  const formatDataCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">
          센서 데이터 모니터링
        </h2>
        <p className="text-muted-foreground">
          AMR 디바이스별 수집 세션을 선택하여 상세 데이터를 확인하세요.
        </p>
      </div>

      {/* 필터 및 검색 바 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* 검색 입력 */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="세션 ID 또는 디바이스 ID로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* 필터 컨트롤 */}
            <div className="flex gap-2">
              <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="디바이스 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 디바이스</SelectItem>
                  {uniqueDevices.map((deviceId) => (
                    <SelectItem key={deviceId} value={deviceId}>
                      <div className="flex items-center gap-2">
                        {deviceId}
                        {isSampleDevice(deviceId) && (
                          <Badge
                            variant="outline"
                            className="text-xs px-1 py-0 bg-orange-50 text-orange-700 border-orange-200"
                          >
                            SAMPLE
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="상태 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 상태</SelectItem>
                  <SelectItem value="active">수집 중</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                  <SelectItem value="paused">일시정지</SelectItem>
                  <SelectItem value="error">오류</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>

              {/* 선택/삭제 컨트롤 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  선택됨: {selectedCount}개
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setSelectedIds(
                      Object.fromEntries(
                        filteredSessions.map((s) => [s.sessionId, true])
                      )
                    )
                  }
                >
                  전체 선택
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  선택 해제
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={deleting || selectedCount === 0}
                  onClick={() => deleteSelected()}
                >
                  선택 삭제
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 에러 표시 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 세션 카드 그리드 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSessions.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSessions.map((session) => {
            const statusBadge = getStatusBadge(session.status);
            const duration = getSessionDuration(session);
            const dataCount = formatDataCount(session.dataCount);

            return (
              <Card
                key={session.sessionId}
                className="hover:shadow-lg transition-shadow cursor-pointer group"
                onClick={(e) => {
                  // 카드 내부 체크박스 클릭은 전파 차단
                  if ((e.target as HTMLElement).closest("input[type=checkbox]"))
                    return;
                  handleSessionClick(session.sessionId);
                }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="accent-black"
                          checked={!!selectedIds[session.sessionId]}
                          onChange={() => toggleSelect(session.sessionId)}
                          onClick={(e) => e.stopPropagation()}
                        />

                        <span>{session.deviceId}</span>
                        {isSampleDevice(session.deviceId) && (
                          <Badge
                            variant="outline"
                            className="text-xs px-1.5 py-0.5 bg-orange-50 text-orange-700 border-orange-200"
                          >
                            SAMPLE
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {session.sessionId.split("-").slice(-1)[0]}
                      </p>
                    </div>
                    <Badge className={statusBadge.color}>
                      {statusBadge.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 시작 시간 */}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">시작:</span>
                    <span className="font-medium">
                      {format(new Date(session.startTime), "MM/dd HH:mm", {
                        locale: ko,
                      })}
                    </span>
                  </div>

                  {/* 수집 시간 */}
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">수집 시간:</span>
                    <span className="font-medium">{duration}</span>
                  </div>

                  {/* 데이터 수 */}
                  <div className="flex items-center gap-2 text-sm">
                    <Database className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">데이터:</span>
                    <span className="font-medium">{dataCount} 건</span>
                  </div>

                  {/* 마지막 데이터 시간 */}
                  {session.lastDataTime && (
                    <div className="flex items-center gap-2 text-sm">
                      <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground">최근:</span>
                      <span className="font-medium">
                        {format(new Date(session.lastDataTime), "HH:mm:ss", {
                          locale: ko,
                        })}
                      </span>
                    </div>
                  )}

                  {/* 호버 시 표시되는 액션 힌트 */}
                  <div className="pt-2 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      클릭하여 상세 보기
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">세션이 없습니다</h3>
            <p className="text-sm text-muted-foreground">
              {selectedDevice !== "all"
                ? `${selectedDevice} 디바이스의 세션이 없습니다.`
                : searchTerm
                ? "검색 결과가 없습니다."
                : "아직 수집된 데이터 세션이 없습니다."}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              스마트폰 앱에서 데이터 수집을 시작하세요.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
