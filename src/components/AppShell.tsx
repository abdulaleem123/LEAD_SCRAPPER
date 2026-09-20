"use client";

import { usePathname } from "next/navigation";
import { Nav } from "./Nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen grid-bg">
      <Nav pathname={pathname} />
      <main className="mx-auto w-full max-w-7xl px-5 py-8">{children}</main>
    </div>
  );
}
