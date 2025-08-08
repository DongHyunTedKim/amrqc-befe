"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, Clock, Database, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Session {
  sessionId: string;
  deviceId: string;
  startTime: number;
  endTime?: number;
  status: "active" | "completed" | "error" | "paused";
  description?: string;
  dataCount?: number;
}

interface SessionSelectorProps {
  deviceId?: string;
  onSessionSelect: (sessionId: string | null) => void;
  selectedSessionId?: string | null;
  showCreateButton?: boolean;
}

export function SessionSelector({
  deviceId,
  onSessionSelect,
  selectedSessionId,
  showCreateButton = true,
}: SessionSelectorProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // 세션 목록 조회
  const fetchSessions = async () => {
    if (!deviceId) {
      setSessions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ deviceId });
      const response = await fetch(
        `http://localhost:8000/api/sessions?${params}`
      );

      if (!response.ok) {
        throw new Error(`세션 목록 조회 실패: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setSessions(result.data || []);
      } else {
        throw new Error(result.error || "세션 목록 조회 실패");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "알 수 없는 오류");
      console.error("세션 목록 조회 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  // 새 세션 생성
  const createSession = async () => {
    if (!deviceId) return;

    setCreating(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:8000/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          description: `Manual session created at ${new Date().toLocaleString(
            "ko-KR"
          )}`,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || `세션 생성 실패: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        // 세션 목록 새로고침
        await fetchSessions();
        // 새로 생성된 세션 선택
        if (result.data?.sessionId) {
          onSessionSelect(result.data.sessionId);
        }
      } else {
        throw new Error(result.error || "세션 생성 실패");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "알 수 없는 오류");
      console.error("세션 생성 오류:", error);
    } finally {
      setCreating(false);
    }
  };

  // 세션 종료
  const endSession = async (sessionId: string) => {
    setError(null);

    try {
      const response = await fetch(
        `http://localhost:8000/api/sessions/${sessionId}/end`,
        {
          method: "PUT",
        }
      );

      if (!response.ok) {
        throw new Error(`세션 종료 실패: ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        // 세션 목록 새로고침
        await fetchSessions();
        // 종료된 세션이 선택되어 있었다면 선택 해제
        if (selectedSessionId === sessionId) {
          onSessionSelect(null);
        }
      } else {
        throw new Error(result.error || "세션 종료 실패");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "알 수 없는 오류");
      console.error("세션 종료 오류:", error);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [deviceId]);

  // 세션 상태에 따른 배지 색상
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "completed":
        return "secondary";
      case "error":
        return "destructive";
      case "paused":
        return "outline";
      default:
        return "secondary";
    }
  };

  // 세션 표시 텍스트 생성
  const getSessionDisplayText = (session: Session) => {
    const startDate = new Date(session.startTime);
    const formattedDate = format(startDate, "MM/dd HH:mm", { locale: ko });
    const dataInfo = session.dataCount ? ` (${session.dataCount}개)` : "";
    return `${formattedDate} - ${session.status}${dataInfo}`;
  };

  if (!deviceId) {
    return (
      <Card className="p-4 bg-muted/50">
        <p className="text-sm text-muted-foreground">
          먼저 디바이스를 선택해주세요
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Select
          value={selectedSessionId || ""}
          onValueChange={(value) => onSessionSelect(value || null)}
          disabled={loading}
        >
          <SelectTrigger className="flex-1">
            <SelectValue
              placeholder={loading ? "로딩 중..." : "세션을 선택하세요"}
            >
              {selectedSessionId &&
                sessions.find((s) => s.sessionId === selectedSessionId) && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {getSessionDisplayText(
                      sessions.find((s) => s.sessionId === selectedSessionId)!
                    )}
                  </div>
                )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {sessions.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                세션이 없습니다
              </div>
            ) : (
              sessions.map((session) => (
                <SelectItem key={session.sessionId} value={session.sessionId}>
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{getSessionDisplayText(session)}</span>
                    </div>
                    <Badge variant={getStatusBadgeVariant(session.status)}>
                      {session.status}
                    </Badge>
                  </div>
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        {showCreateButton && (
          <Button
            onClick={createSession}
            disabled={creating || loading}
            size="sm"
            variant="outline"
          >
            {creating ? (
              <>
                <Clock className="h-4 w-4 mr-2 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />새 세션
              </>
            )}
          </Button>
        )}

        {selectedSessionId &&
          sessions.find(
            (s) => s.sessionId === selectedSessionId && s.status === "active"
          ) && (
            <Button
              onClick={() => endSession(selectedSessionId)}
              size="sm"
              variant="destructive"
              title="세션 종료"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      {selectedSessionId &&
        sessions.find((s) => s.sessionId === selectedSessionId) && (
          <Card className="p-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">시작:</span>
                <span className="font-medium">
                  {format(
                    new Date(
                      sessions.find(
                        (s) => s.sessionId === selectedSessionId
                      )!.startTime
                    ),
                    "yyyy-MM-dd HH:mm:ss",
                    { locale: ko }
                  )}
                </span>
              </div>
              {sessions.find((s) => s.sessionId === selectedSessionId)!
                .endTime && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">종료:</span>
                  <span className="font-medium">
                    {format(
                      new Date(
                        sessions.find(
                          (s) => s.sessionId === selectedSessionId
                        )!.endTime!
                      ),
                      "yyyy-MM-dd HH:mm:ss",
                      { locale: ko }
                    )}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Database className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">데이터:</span>
                <span className="font-medium">
                  {sessions.find((s) => s.sessionId === selectedSessionId)!
                    .dataCount || 0}
                  개
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">상태:</span>
                <Badge
                  variant={getStatusBadgeVariant(
                    sessions.find((s) => s.sessionId === selectedSessionId)!
                      .status
                  )}
                >
                  {
                    sessions.find((s) => s.sessionId === selectedSessionId)!
                      .status
                  }
                </Badge>
              </div>
            </div>
          </Card>
        )}
    </div>
  );
}
