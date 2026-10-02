"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD, TRMessage } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import { PageHeader, PARTY_SIBLINGS } from "@/components/patterns/page-header";
import { Field } from "@/components/forms/form-field";
import { formatNumber } from "@/lib/format/number";
import { savePartyGroupAction, deletePartyGroupAction } from "@/server/actions/parties";

interface GroupRow {
  id: string;
  name: string;
  partyCount: number;
}

/** Party groups, which the Sale Purchase By Party Group report rolls up by. */
export function GroupsScreen({
  groups,
  canWrite,
}: {
  groups: GroupRow[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<GroupRow | null>(null);
  const [creating, setCreating] = React.useState(false);

  async function remove(group: GroupRow) {
    const result = await deletePartyGroupAction({ id: group.id });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(`${group.name} removed`);
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Party Groups"
        siblings={PARTY_SIBLINGS}
        description="Group parties to roll up reports by segment, route or salesperson."
        actions={
          canWrite ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              Add Group
            </Button>
          ) : null
        }
      />

      <div className="p-4 sm:p-6">
        <div className="surface-card overflow-hidden">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Group</TH>
                <TH align="right">Parties</TH>
                {canWrite ? <TH align="right">Actions</TH> : null}
              </TR>
            </THead>
            <TBody>
              {groups.length === 0 ? (
                <TRMessage colSpan={canWrite ? 3 : 2}>
                  <EmptyState
                    title="No party groups"
                    description="Groups are optional, but they make the party reports far more useful."
                    action={
                      canWrite ? (
                        <Button onClick={() => setCreating(true)}>
                          <Plus className="size-4" />
                          Add Group
                        </Button>
                      ) : undefined
                    }
                  />
                </TRMessage>
              ) : (
                groups.map((group) => (
                  <TR key={group.id}>
                    <TD className="font-medium">{group.name}</TD>
                    <TD align="right" numeric>
                      {formatNumber(group.partyCount, { decimals: 0 })}
                    </TD>
                    {canWrite ? (
                      <TD align="right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="grid size-8 place-items-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
                              aria-label={`Options for ${group.name}`}
                            >
                              <MoreVertical className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setEditing(group)}>
                              <Pencil />
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem destructive onSelect={() => void remove(group)}>
                              <Trash2 />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TD>
                    ) : null}
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>
      </div>

      <GroupDialog
        open={creating || !!editing}
        group={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          router.refresh();
        }}
      />
    </div>
  );
}

function GroupDialog({
  open,
  group,
  onClose,
  onSaved,
}: {
  open: boolean;
  group: GroupRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
    setError(null);
  }, [open, group]);

  async function save() {
    setSaving(true);
    setError(null);

    const result = await savePartyGroupAction({ id: group?.id, name });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    toast.success(group ? "Group renamed" : `${name} added`);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onClose())}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{group ? "Rename group" : "Add party group"}</DialogTitle>
          <DialogDescription>
            Deleting a group later leaves its parties in place, ungrouped.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {error ? (
            <p className="mb-4 rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-[13px] text-[var(--color-negative)]">
              {error}
            </p>
          ) : null}

          <Field id="groupName" label="Name" required>
            <Input
              id="groupName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="Thrissur route"
            />
          </Field>
        </DialogBody>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
