"use client";

import { useActionState, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Badge, Button, Select } from "@roundzero/ui";

import {
  promoteToCaptain,
  removeMember,
  setMachineRole,
  type RosterActionState,
} from "./actions";
import { machineRoleLabel, roleLabel, type MachineRole } from "@/lib/teams";

export interface RosterMember {
  id: string;
  name: string;
  email: string;
  role: string;
  machineRole: MachineRole | null;
}

const initialState: RosterActionState = {};

export function RosterTable({
  members,
  isCoach,
}: {
  members: RosterMember[];
  isCoach: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-hairline">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-surface-2 text-xs text-text-dim">
          <tr>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Role</th>
            <th className="px-4 py-2 font-medium">Machine role</th>
            {isCoach && <th className="px-4 py-2 font-medium">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {members.map((member) => (
            <RosterRow key={member.id} member={member} isCoach={isCoach} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RosterRow({
  member,
  isCoach,
}: {
  member: RosterMember;
  isCoach: boolean;
}) {
  const [machineState, machineAction, machinePending] = useActionState(
    setMachineRole,
    initialState,
  );
  const [promoteState, promoteAction, promotePending] = useActionState(
    promoteToCaptain,
    initialState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeMember,
    initialState,
  );
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const rowError = machineState.error ?? promoteState.error ?? removeState.error;
  const columnCount = isCoach ? 4 : 3;

  return (
    <>
      <tr>
        <td className="px-4 py-3 align-top">
          <div className="text-text">{member.name}</div>
          <div className="font-mono text-xs text-text-dim">{member.email}</div>
        </td>
        <td className="px-4 py-3 align-top">
          <Badge tone={member.role === "coach" ? "accent" : "neutral"}>
            {roleLabel(member.role)}
          </Badge>
        </td>
        <td className="px-4 py-3 align-top">
          {isCoach ? (
            <form action={machineAction}>
              <input type="hidden" name="memberId" value={member.id} />
              <Select
                name="machineRole"
                className="min-w-[130px]"
                defaultValue={member.machineRole ?? "NONE"}
                disabled={machinePending}
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
                aria-label={`Machine role for ${member.name}`}
              >
                <option value="NONE">Unassigned</option>
                <option value="WINDOWS">Windows</option>
                <option value="LINUX">Linux</option>
                <option value="CISCO">Cisco</option>
              </Select>
            </form>
          ) : (
            <span className="text-text-dim">
              {machineRoleLabel(member.machineRole)}
            </span>
          )}
        </td>
        {isCoach && (
          <td className="px-4 py-3 align-top">
            <div className="flex flex-wrap items-center gap-2">
              {member.role === "member" && (
                <form action={promoteAction}>
                  <input type="hidden" name="memberId" value={member.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={promotePending}
                  >
                    Promote to captain
                  </Button>
                </form>
              )}
              {member.role !== "coach" &&
                (confirmingRemove ? (
                  <form action={removeAction} className="flex items-center gap-2">
                    <input type="hidden" name="memberId" value={member.id} />
                    <span className="text-xs text-text-dim">
                      Remove {member.name}?
                    </span>
                    <Button
                      type="submit"
                      variant="destructive"
                      size="sm"
                      disabled={removePending}
                    >
                      Confirm remove
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingRemove(false)}
                      disabled={removePending}
                    >
                      Cancel
                    </Button>
                  </form>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingRemove(true)}
                  >
                    Remove
                  </Button>
                ))}
            </div>
          </td>
        )}
      </tr>
      {rowError && (
        <tr>
          <td colSpan={columnCount} className="px-4 pb-3">
            <div className="flex items-start gap-2 rounded-md border border-hairline bg-surface-2 p-3">
              <AlertCircle
                className="mt-0.5 size-4 shrink-0 text-text-dim"
                strokeWidth={1.75}
                aria-hidden="true"
              />
              <p className="text-sm text-text">{rowError}</p>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
