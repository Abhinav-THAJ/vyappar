import type { Metadata } from "next";
import { requireCompany } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listMembers } from "@/server/actions/members";
import { UsersScreen } from "./users-screen";

export const metadata: Metadata = { title: "Users & Roles" };

export default async function UsersPage() {
  const ctx = await requireCompany();
  const members = await listMembers(ctx.companyId);

  return (
    <UsersScreen
      members={members}
      currentUserId={ctx.user.id}
      canManage={can(ctx.role, "company.manage")}
    />
  );
}
