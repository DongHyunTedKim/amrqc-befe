"use client";

import { Wifi } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex flex-1 items-center justify-between">
          {/* 로고 */}
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">AMR QC</h1>
            <span className="text-sm text-muted-foreground">솔루션</span>
          </div>

          {/* 서버 연결 상태 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">서버 연결됨</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
