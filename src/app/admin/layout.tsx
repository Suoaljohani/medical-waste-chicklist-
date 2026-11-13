import type { Metadata } from "next";
import { AdminShell } from "./admin-shell";

export const metadata: Metadata = { title: "لوحة الإدارة" };

// The admin pages render only after the client confirms the session, so there is no instant shell to validate.
export const instant = false;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
