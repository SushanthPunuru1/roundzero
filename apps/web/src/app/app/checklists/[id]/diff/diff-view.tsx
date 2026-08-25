"use client";

import { useActionState, type ReactNode } from "react";
import { Check, ClipboardList, RotateCcw } from "lucide-react";
import { Button, EmptyState, ErrorNote, Eyebrow } from "@roundzero/ui";

import {
  addUpstreamItemToFork,
  revertForkItemField,
  setForkItemRemoved,
  type ChecklistActionState,
} from "../../actions";
import { commandEntries, commandLabel } from "@/lib/checklists";

const initialState: ChecklistActionState = {};

export interface DiffViewData {
  teamChecklistId: string;
  canEdit: boolean;
  teamAddedCount: number;
  updatedConflicting: {
    upstreamItemId: string;
    teamRowId: string;
    action: string;
    fields: ("action" | "why" | "commands")[];
    upstreamValues: { action: string; why: string; commands: Record<string, string> };
    teamValues: { action: string | null; why: string | null; commands: Record<string, string> | null };
  }[];
  added: { upstreamItemId: string; action: string; why: string }[];
  removedByTeam: { upstreamItemId: string; teamRowId: string; action: string }[];
  retiredUpstream: { upstreamItemId: string; action: string | null }[];
}

const FIELD_LABEL: Record<"action" | "why" | "commands", string> = {
  action: "Action",
  why: "Why",
  commands: "Commands",
};

function formatCommandsForDiff(map: Record<string, string>): string {
  const entries = commandEntries(map);
  if (entries.length === 0) return "(no commands)";
  return entries.map(([key, command]) => `${commandLabel(key)}: ${command}`).join("\n\n");
}

export function DiffView({ data }: { data: DiffViewData }) {
  const nothingToReview =
    data.updatedConflicting.length === 0 &&
    data.added.length === 0 &&
    data.removedByTeam.length === 0 &&
    data.retiredUpstream.length === 0;

  return (
    <div className="flex flex-col gap-8">
      {data.updatedConflicting.length > 0 && (
        <Section
          title="Upstream changed a field you've pinned"
          description="You're pinned to older wording and won't see the correction unless you accept upstream. This is the one that matters."
        >
          {data.updatedConflicting.map((entry) => (
            <ConflictingItem
              key={entry.upstreamItemId}
              teamChecklistId={data.teamChecklistId}
              entry={entry}
              canEdit={data.canEdit}
            />
          ))}
        </Section>
      )}

      {data.added.length > 0 && (
        <Section title="New upstream items" description="Upstream added these since you forked.">
          {data.added.map((item) => (
            <AddedItem
              key={item.upstreamItemId}
              teamChecklistId={data.teamChecklistId}
              item={item}
              canEdit={data.canEdit}
            />
          ))}
        </Section>
      )}

      {data.removedByTeam.length > 0 && (
        <Section title="Removed by you" description="Soft-hidden, not deleted — restorable any time.">
          {data.removedByTeam.map((item) => (
            <RemovedItem
              key={item.upstreamItemId}
              teamChecklistId={data.teamChecklistId}
              item={item}
              canEdit={data.canEdit}
            />
          ))}
        </Section>
      )}

      {data.retiredUpstream.length > 0 && (
        <Section
          title="Retired upstream"
          description="Upstream no longer has these items; your row still does."
        >
          {data.retiredUpstream.map((item) => (
            <div key={item.upstreamItemId} className="p-4 text-sm text-text-dim">
              {item.action ?? "No text was ever recorded for this item."}
            </div>
          ))}
        </Section>
      )}

      {data.teamAddedCount > 0 && (
        <p className="text-sm text-text-dim">
          You&apos;ve also added {data.teamAddedCount} custom item
          {data.teamAddedCount === 1 ? "" : "s"} — visible directly in your checklist, upstream will
          never touch them.
        </p>
      )}

      {nothingToReview && data.teamAddedCount === 0 && (
        <EmptyState icon={ClipboardList} message="Nothing to review — your fork matches upstream." />
      )}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <p className="mt-1 text-sm text-text-dim">{description}</p>
      <div className="mt-3 divide-y divide-hairline rounded-md border border-hairline bg-surface">
        {children}
      </div>
    </div>
  );
}

function ConflictingItem({
  teamChecklistId,
  entry,
  canEdit,
}: {
  teamChecklistId: string;
  entry: DiffViewData["updatedConflicting"][number];
  canEdit: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <p className="text-sm font-medium text-text">{entry.action}</p>
      {entry.fields.map((field) => {
        const upstreamValue =
          field === "commands"
            ? formatCommandsForDiff(entry.upstreamValues.commands)
            : entry.upstreamValues[field];
        const teamValue =
          field === "commands"
            ? formatCommandsForDiff(entry.teamValues.commands ?? {})
            : (entry.teamValues[field] ?? "");
        return (
          <ConflictingField
            key={field}
            teamChecklistId={teamChecklistId}
            itemId={entry.teamRowId}
            field={field}
            upstreamValue={upstreamValue}
            teamValue={teamValue}
            mono={field === "commands"}
            canEdit={canEdit}
          />
        );
      })}
    </div>
  );
}

function ConflictingField({
  teamChecklistId,
  itemId,
  field,
  upstreamValue,
  teamValue,
  mono,
  canEdit,
}: {
  teamChecklistId: string;
  itemId: string;
  field: "action" | "why" | "commands";
  upstreamValue: string;
  teamValue: string;
  mono: boolean;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(revertForkItemField, initialState);
  const textClass = mono ? "whitespace-pre-wrap font-mono text-[13px] text-text" : "text-sm text-text";

  return (
    <div className="rounded-md border border-hairline bg-surface-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>{FIELD_LABEL[field]}</Eyebrow>
        {canEdit && (
          <form action={formAction}>
            <input type="hidden" name="teamChecklistId" value={teamChecklistId} />
            <input type="hidden" name="itemId" value={itemId} />
            <input type="hidden" name="field" value={field} />
            <Button type="submit" variant="ghost" size="sm" disabled={pending}>
              <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              Accept upstream
            </Button>
          </form>
        )}
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.06em] text-text-dim">Yours</p>
          <p className={`mt-1 ${textClass}`}>{teamValue}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.06em] text-text-dim">Upstream</p>
          <p className={`mt-1 ${textClass}`}>{upstreamValue}</p>
        </div>
      </div>
      {state.error && <ErrorNote className="mt-2">{state.error}</ErrorNote>}
    </div>
  );
}

function AddedItem({
  teamChecklistId,
  item,
  canEdit,
}: {
  teamChecklistId: string;
  item: DiffViewData["added"][number];
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(addUpstreamItemToFork, initialState);

  return (
    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text">{item.action}</p>
        <p className="mt-1 text-sm text-text-dim">{item.why}</p>
      </div>
      {canEdit && (
        <form action={formAction} className="shrink-0">
          <input type="hidden" name="teamChecklistId" value={teamChecklistId} />
          <input type="hidden" name="upstreamItemId" value={item.upstreamItemId} />
          <Button type="submit" variant="ghost" size="sm" disabled={pending}>
            <Check className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
            Add to our checklist
          </Button>
        </form>
      )}
      {state.error && <ErrorNote className="mt-2">{state.error}</ErrorNote>}
    </div>
  );
}

function RemovedItem({
  teamChecklistId,
  item,
  canEdit,
}: {
  teamChecklistId: string;
  item: DiffViewData["removedByTeam"][number];
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(setForkItemRemoved, initialState);

  return (
    <div className="flex items-center justify-between gap-3 p-4">
      <p className="text-sm text-text-dim line-through decoration-text-dim">{item.action}</p>
      {canEdit && (
        <form action={formAction} className="shrink-0">
          <input type="hidden" name="teamChecklistId" value={teamChecklistId} />
          <input type="hidden" name="itemId" value={item.teamRowId} />
          <input type="hidden" name="removed" value="false" />
          <Button type="submit" variant="ghost" size="sm" disabled={pending}>
            Restore
          </Button>
        </form>
      )}
      {state.error && <ErrorNote className="mt-2">{state.error}</ErrorNote>}
    </div>
  );
}
