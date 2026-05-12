"use client";

import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "@/components/Sidebar";
import { SocketBridge } from "@/components/SocketBridge";
import { SidebarResizer } from "@/components/SidebarResizer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard require="authenticated">
      <SocketBridge />
      <div className="h-screen w-screen flex bg-bg overflow-hidden">
        <SidebarResizer>
          {(width, dragHandle) => (
            <>
              <aside
                style={{ width }}
                className="shrink-0 border-r border-border bg-bg-panel flex flex-col"
              >
                <Sidebar />
              </aside>
              <div
                {...dragHandle}
                className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-accent/50 active:bg-accent transition-colors"
              />
              <section className="flex-1 min-w-0 flex flex-col">{children}</section>
            </>
          )}
        </SidebarResizer>
      </div>
    </AuthGuard>
  );
}
