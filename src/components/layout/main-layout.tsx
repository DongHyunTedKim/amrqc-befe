"use client";

import { Header } from "./header";
import { Sidebar } from "./sidebar";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="relative flex flex-1 pt-14">
        <Sidebar />
        <main className="flex-1 overflow-y-auto md:ml-64">
          <div className="container py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
