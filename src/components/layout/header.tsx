"use client";

import { Moon, Sun, Wifi, WifiOff } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { setTheme, theme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="flex flex-1 items-center justify-between">
          {/* 로고 */}
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">AMR QC</h1>
            <span className="text-sm text-muted-foreground">솔루션</span>
          </div>

          {/* 서버 연결 상태 및 테마 토글 */}
          <div className="flex items-center gap-4">
            {/* 서버 연결 상태 */}
            <div className="flex items-center gap-2">
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">서버 연결됨</span>
            </div>

            {/* 테마 토글 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">테마 변경</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  밝은 테마
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  어두운 테마
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  시스템 설정
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
