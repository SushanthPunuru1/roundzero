"use client";

import { startTransition, useActionState, useState } from "react";
import { Avatar, Badge, Button, ErrorNote, Select } from "@roundzero/ui";

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
        <thead className="bg-surface-2 text-[13px] text-text-dim">
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

  // Controlled: React resets uncontrolled form fields after a form action
  // resolves, which snapped this back to its original defaultValue even
  // though the write had already persisted. Keeping it controlled (synced
  // from the server-confirmed prop) survives that reset. Resynced during
  // render (not an effect) per React's documented pattern for adjusting
  // state when a prop changes: https://react.dev/learn/you-might-not-need-an-effect
  const [trackedMachineRole, setTrackedMachineRole] = useState(member.machineRole);
  const [machineRoleValue, setMachineRoleValue] = useState(
    member.machineRole ?? "NONE",
  );
  if (member.machineRole !== trackedMachineRole) {
    setTrackedMachineRole(member.machineRole);
    setMachineRoleValue(member.machineRole ?? "NONE");
  }

  const rowError = machineState.error ?? promoteState.error ?? removeState.error;
  const columnCount = isCoach ? 4 : 3;

  return (
    <>
      <tr className="transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-surface-2">
        <td className="px-4 py-3 align-top">
          <div className="flex items-center gap-3">
            <Avatar name={member.name} size="sm" />
            <div>
              <div className="text-text">{member.name}</div>
              <div className="font-mono text-xs text-text-dim">{member.email}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <Badge tone={member.role === "coach" ? "accent" : "neutral"}>
            {roleLabel(member.role)}
          </Badge>
        </td>
        <td className="px-4 py-3 align-top">
          {isCoach ? (
            // Deliberately not a <form action={machineAction}> submitted via
            // requestSubmit(): React resets a host <form>'s fields as part of
            // submitting it (react-dom's requestFormReset), which snaps a
            // native <select> back to its first <option> regardless of a
            // controlled `value` — calling the action directly sidesteps
            // that host-form reset path entirely.
            <Select
              name="machineRole"
              className="min-w-[150px]"
              value={machineRoleValue}
              disabled={machinePending}
              onChange={(event) => {
                const value = event.target.value;
                setMachineRoleValue(value);
                const formData = new FormData();
                formData.set("memberId", member.id);
                formData.set("machineRole", value);
                startTransition(() => machineAction(formData));
              }}
              aria-label={`Machine role for ${member.name}`}
            >
              <option value="NONE">Unassigned</option>
              <option value="WINDOWS">Windows</option>
              <option value="LINUX">Linux</option>
              <option value="CISCO">Cisco</option>
            </Select>
          ) : (
            <span className="text-text-dim">
              {machineRoleLabel(member.machineRole)}
            </span>
          )}
        </td>
        {isCoach && (
          <td className="px-4 py-3 align-top">
            {member.role === "coach" ? (
              <span className="text-text-dim">
                <span aria-hidden="true">—</span>
                <span className="sr-only">No actions available</span>
              </span>
            ) : (
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
                {confirmingRemove ? (
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
                )}
              </div>
            )}
          </td>
        )}
      </tr>
      {rowError && (
        <tr>
          <td colSpan={columnCount} className="px-4 pb-3">
            <ErrorNote>{rowError}</ErrorNote>
          </td>
        </tr>
      )}
    </>
  );
}
