"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Minus, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/display";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Field } from "@/components/forms/form-field";
import { formatDate } from "@/lib/format/date";
import {
  PERMISSIONS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  permissionsFor,
  type Permission,
} from "@/lib/auth/permissions";
import {
  inviteMemberAction,
  changeMemberRoleAction,
  removeMemberAction,
} from "@/server/actions/members";
import type { Role } from "@prisma/client";
import { initials } from "@/lib/utils";

interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: Role;
  invitedAt: string;
  accepted: boolean;
}

const ASSIGNABLE: Role[] = ["ADMIN", "ACCOUNTANT", "SALESMAN"];
const MATRIX_ROLES: Role[] = ["OWNER", "ADMIN", "ACCOUNTANT", "SALESMAN"];

export function UsersScreen({
  members,
  currentUserId,
  canManage,
}: {
  members: MemberRow[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [inviting, setInviting] = React.useState(false);

  async function changeRole(member: MemberRow, role: Role) {
    const result = await changeMemberRoleAction({ userId: member.userId, role });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${member.name} is now ${ROLE_LABELS[role]}`);
    router.refresh();
  }

  async function remove(member: MemberRow) {
    const result = await removeMemberAction({ userId: member.userId });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${member.name} removed`);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold">Users &amp; Roles</h2>
          <p className="mt-0.5 max-w-xl text-[13px] text-[var(--text-muted)]">
            Anyone you add here sees this company under &ldquo;Companies Shared with Me&rdquo;
            when they log in.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => setInviting(true)}>
            <UserPlus className="size-4" />
            Add user
          </Button>
        ) : null}
      </div>

      <div className="surface-card overflow-hidden">
        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Person</TH>
              <TH>Role</TH>
              <TH>Added</TH>
              {canManage ? <TH align="right">Actions</TH> : null}
            </TR>
          </THead>
          <TBody>
            {members.map((member) => (
              <TR key={member.userId}>
                <TD>
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">
                      {initials(member.name)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium">
                        {member.name}
                        {member.userId === currentUserId ? (
                          <span className="ml-1.5 text-[11px] text-[var(--text-muted)]">(you)</span>
                        ) : null}
                      </div>
                      <div className="truncate text-[12px] text-[var(--text-muted)]">
                        {member.email}
                      </div>
                    </div>
                  </div>
                </TD>
                <TD>
                  {member.role === "OWNER" || !canManage || member.userId === currentUserId ? (
                    <Badge variant={member.role === "OWNER" ? "brand" : "neutral"}>
                      {ROLE_LABELS[member.role]}
                    </Badge>
                  ) : (
                    <Select
                      value={member.role}
                      onValueChange={(v) => void changeRole(member, v as Role)}
                    >
                      <SelectTrigger className="w-40" aria-label={`Role for ${member.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TD>
                <TD className="whitespace-nowrap text-[var(--text-secondary)]">
                  {formatDate(member.invitedAt)}
                </TD>
                {canManage ? (
                  <TD align="right">
                    {member.role !== "OWNER" && member.userId !== currentUserId ? (
                      <Button variant="ghost" size="iconSm" onClick={() => void remove(member)}>
                        <Trash2 className="size-4 text-[var(--color-negative)]" />
                        <span className="sr-only">Remove {member.name}</span>
                      </Button>
                    ) : null}
                  </TD>
                ) : null}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      {/* Permission matrix */}
      <div className="surface-card overflow-hidden">
        <div className="border-b border-[var(--border-subtle)] p-5">
          <h2 className="text-[15px] font-semibold">What each role can do</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {MATRIX_ROLES.map((role) => (
              <div key={role} className="rounded-lg bg-[var(--surface-2)] p-3">
                <div className="text-[13px] font-semibold">{ROLE_LABELS[role]}</div>
                <p className="mt-0.5 text-[12px] leading-snug text-[var(--text-muted)]">
                  {ROLE_DESCRIPTIONS[role]}
                </p>
              </div>
            ))}
          </div>
        </div>

        <Table>
          <THead>
            <TR className="hover:bg-transparent">
              <TH>Capability</TH>
              {MATRIX_ROLES.map((role) => (
                <TH key={role} align="center">
                  {ROLE_LABELS[role]}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {PERMISSIONS.map((permission) => (
              <TR key={permission}>
                <TD className="font-medium">{labelFor(permission)}</TD>
                {MATRIX_ROLES.map((role) => {
                  const allowed = permissionsFor(role).includes(permission);
                  return (
                    <TD key={role} align="center">
                      {allowed ? (
                        <Check
                          className="mx-auto size-4 text-[var(--color-positive)]"
                          aria-label="Allowed"
                        />
                      ) : (
                        <Minus
                          className="mx-auto size-4 text-[var(--text-muted)]"
                          aria-label="Not allowed"
                        />
                      )}
                    </TD>
                  );
                })}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>

      <InviteDialog
        open={inviting}
        onClose={() => setInviting(false)}
        onSaved={() => {
          setInviting(false);
          router.refresh();
        }}
      />
    </div>
  );
}

function labelFor(permission: Permission): string {
  const [area, verb] = permission.split(".");
  const areaLabel: Record<string, string> = {
    company: "Company",
    firm: "Firms",
    settings: "Settings",
    party: "Parties",
    item: "Items",
    sale: "Sales",
    purchase: "Purchases",
    expense: "Expenses",
    cashbank: "Cash & bank",
    report: "Reports",
    transaction: "Transactions",
    data: "Data",
    audit: "Audit log",
  };
  const verbLabel: Record<string, string> = {
    read: "view",
    write: "create and edit",
    manage: "manage",
    delete: "delete",
    export: "export",
    import: "import",
    gst: "GST returns",
  };
  return `${areaLabel[area ?? ""] ?? area} — ${verbLabel[verb ?? ""] ?? verb}`;
}

function InviteDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("SALESMAN");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName("");
    setEmail("");
    setRole("SALESMAN");
    setPassword("");
    setErrors({});
    setFormError(null);
  }, [open]);

  async function save() {
    setSaving(true);
    setErrors({});
    setFormError(null);

    const result = await inviteMemberAction({
      name,
      email,
      role,
      password: password || undefined,
    });

    setSaving(false);

    if (!result.ok) {
      setFormError(result.error);
      const next: Record<string, string> = {};
      for (const [k, v] of Object.entries(result.fieldErrors ?? {})) next[k] = v[0]!;
      setErrors(next);
      return;
    }

    toast.success(
      result.data.created ? `${name} added with a new account` : `${name} given access`,
    );
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            If they already have an account, leave the password blank.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {formError ? (
            <p className="rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">
              {formError}
            </p>
          ) : null}

          <Field id="name" label="Name" required error={errors.name}>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              invalid={!!errors.name}
            />
          </Field>

          <Field id="email" label="Email" required error={errors.email}>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              invalid={!!errors.email}
            />
          </Field>

          <Field id="role" label="Role" required error={errors.role}>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]} — {ROLE_DESCRIPTIONS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            id="password"
            label="Temporary password"
            hint="Only needed if this email has no account yet."
            error={errors.password}
          >
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!errors.password}
            />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Add user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
