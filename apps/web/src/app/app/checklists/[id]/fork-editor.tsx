"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, RotateCcw, TriangleAlert, X } from "lucide-react";
import { Badge, Button, ErrorNote, Eyebrow, Input, Textarea } from "@roundzero/ui";
import type { ResolvedItem } from "@roundzero/db";

import {
  addForkItem,
  moveForkItem,
  revertForkItemField,
  setForkItemRemoved,
  updateForkItemCommands,
  updateForkItemText,
  type ChecklistActionState,
} from "../actions";
import { commandEntries, commandLabel } from "@/lib/checklists";
import { originLabel, sameCommandsMap, type CommandDraftEntry } from "@/lib/checklist-fork";
import { CommandBlock } from "./command-block";

const initialState: ChecklistActionState = {};

export function ForkEditor({
  teamChecklistId,
  items,
  canEdit,
}: {
  teamChecklistId: string;
  items: ResolvedItem[];
  canEdit: boolean;
}) {
  const visible = items.filter((item) => !item.removed).sort((a, b) => a.sortOrder - b.sortOrder);
  const removedItems = items.filter((item) => item.removed).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="flex flex-col gap-8">
      <div className="divide-y divide-hairline border-y border-hairline">
        {visible.map((item, index) => (
          <ForkItemRow
            key={item.id}
            teamChecklistId={teamChecklistId}
            item={item}
            index={index}
            isFirst={index === 0}
            isLast={index === visible.length - 1}
            canEdit={canEdit}
          />
        ))}
      </div>

      {canEdit && <AddItemForm teamChecklistId={teamChecklistId} />}

      {removedItems.length > 0 && (
        <div>
          <Eyebrow>Removed by your team</Eyebrow>
          <div className="mt-2 divide-y divide-hairline border-y border-hairline">
            {removedItems.map((item) => (
              <RemovedItemRow
                key={item.id}
                teamChecklistId={teamChecklistId}
                item={item}
                canEdit={canEdit}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ForkItemRow({
  teamChecklistId,
  item,
  index,
  isFirst,
  isLast,
  canEdit,
}: {
  teamChecklistId: string;
  item: ResolvedItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  canEdit: boolean;
}) {
  const [moveState, moveAction, movePending] = useActionState(moveForkItem, initialState);
  const [removeState, removeAction, removePending] = useActionState(setForkItemRemoved, initialState);

  return (
    <div className="flex items-start gap-3 py-4">
      <span className="mt-1 w-6 shrink-0 text-right font-mono text-xs tabular-nums text-text-dim">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={item.origin === "upstream" ? "neutral" : "accent"}>{originLabel(item.origin)}</Badge>
          {item.caution && (
            <span className="inline-flex items-center gap-1 text-xs text-accent">
              <TriangleAlert className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              {item.caution}
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-col gap-3">
          <EditableField
            teamChecklistId={teamChecklistId}
            itemId={item.id}
            field="action"
            label="Action"
            value={item.action}
            isEdited={item.editedFields.includes("action")}
            canEdit={canEdit}
          />
          <EditableField
            teamChecklistId={teamChecklistId}
            itemId={item.id}
            field="why"
            label="Why"
            value={item.why}
            isEdited={item.editedFields.includes("why")}
            canEdit={canEdit}
          />
          <CommandsEditor
            teamChecklistId={teamChecklistId}
            itemId={item.id}
            commands={item.commands}
            isEdited={item.editedFields.includes("commands")}
            canEdit={canEdit}
          />
        </div>

        {canEdit && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <form action={moveAction}>
              <input type="hidden" name="teamChecklistId" value={teamChecklistId} />
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="direction" value="up" />
              <Button type="submit" variant="ghost" size="sm" disabled={movePending || isFirst}>
                <ArrowUp className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span className="sr-only">Move up</span>
              </Button>
            </form>
            <form action={moveAction}>
              <input type="hidden" name="teamChecklistId" value={teamChecklistId} />
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="direction" value="down" />
              <Button type="submit" variant="ghost" size="sm" disabled={movePending || isLast}>
                <ArrowDown className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                <span className="sr-only">Move down</span>
              </Button>
            </form>
            <form action={removeAction}>
              <input type="hidden" name="teamChecklistId" value={teamChecklistId} />
              <input type="hidden" name="itemId" value={item.id} />
              <input type="hidden" name="removed" value="true" />
              <Button type="submit" variant="ghost" size="sm" disabled={removePending}>
                Remove
              </Button>
            </form>
          </div>
        )}

        {(moveState.error || removeState.error) && (
          <ErrorNote className="mt-2">{moveState.error ?? removeState.error}</ErrorNote>
        )}
      </div>
    </div>
  );
}

function RemovedItemRow({
  teamChecklistId,
  item,
  canEdit,
}: {
  teamChecklistId: string;
  item: ResolvedItem;
  canEdit: boolean;
}) {
  const [state, restoreAction, pending] = useActionState(setForkItemRemoved, initialState);

  return (
    <div className="flex items-start justify-between gap-3 py-3 opacity-60">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text line-through decoration-text-dim">{item.action}</p>
        <p className="mt-0.5 text-xs text-text-dim">{originLabel(item.origin)}</p>
      </div>
      {canEdit && (
        <form action={restoreAction}>
          <input type="hidden" name="teamChecklistId" value={teamChecklistId} />
          <input type="hidden" name="itemId" value={item.id} />
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

/** A field's editing surface — a resynced-from-server Textarea, a Save
 * button that appears once the draft actually differs, and (when this field
 * is pinned) a "Revert to upstream" button that writes null. Not used for
 * team-added items' fields at all — those always render editable since they
 * have nothing to revert to. */
function EditableField({
  teamChecklistId,
  itemId,
  field,
  value,
  isEdited,
  canEdit,
  label,
}: {
  teamChecklistId: string;
  itemId: string;
  field: "action" | "why";
  value: string;
  isEdited: boolean;
  canEdit: boolean;
  label: string;
}) {
  const [tracked, setTracked] = useState(value);
  const [draft, setDraft] = useState(value);
  if (value !== tracked) {
    setTracked(value);
    setDraft(value);
  }

  const [state, formAction, pending] = useActionState(updateForkItemText, initialState);
  const [revertState, revertAction, revertPending] = useActionState(revertForkItemField, initialState);

  if (!canEdit) {
    return (
      <div>
        <Eyebrow>{label}</Eyebrow>
        <p className="mt-1 text-sm text-text">{value}</p>
      </div>
    );
  }

  const dirty = draft.trim() !== value.trim();
  const error = state.error ?? revertState.error;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow id={`${itemId}-${field}-label`}>{label}</Eyebrow>
        {isEdited && (
          <form action={revertAction}>
            <input type="hidden" name="teamChecklistId" value={teamChecklistId} />
            <input type="hidden" name="itemId" value={itemId} />
            <input type="hidden" name="field" value={field} />
            <Button type="submit" variant="ghost" size="sm" disabled={revertPending}>
              <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              Revert to upstream
            </Button>
          </form>
        )}
      </div>
      <form action={formAction} className="flex flex-col items-start gap-2 sm:flex-row">
        <input type="hidden" name="teamChecklistId" value={teamChecklistId} />
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="field" value={field} />
        <Textarea
          name="value"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={pending}
          className="min-h-[44px] flex-1"
          aria-labelledby={`${itemId}-${field}-label`}
        />
        {dirty && (
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        )}
      </form>
      {error && <ErrorNote>{error}</ErrorNote>}
    </div>
  );
}

function CommandEntriesFields({
  entries,
  onChange,
  disabled,
}: {
  entries: CommandDraftEntry[];
  onChange: (entries: CommandDraftEntry[]) => void;
  disabled: boolean;
}) {
  function updateEntry(index: number, patch: Partial<CommandDraftEntry>) {
    onChange(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  }
  function removeEntry(index: number) {
    onChange(entries.filter((_, i) => i !== index));
  }
  function addEntry() {
    onChange([...entries, { key: "", value: "" }]);
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, index) => (
        <div
          key={index}
          className="flex flex-col gap-1 rounded-md border border-hairline bg-surface-2 p-2"
        >
          <div className="flex items-center gap-2">
            <Input
              value={entry.key}
              onChange={(event) => updateEntry(index, { key: event.target.value })}
              placeholder="all, ubuntu22, ubuntu24…"
              className="max-w-[160px] font-mono text-xs"
              disabled={disabled}
              aria-label="OS variant"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeEntry(index)}
              disabled={disabled}
            >
              <X className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              <span className="sr-only">Remove variant</span>
            </Button>
          </div>
          <Textarea
            value={entry.value}
            onChange={(event) => updateEntry(index, { value: event.target.value })}
            className="font-mono text-[13px]"
            disabled={disabled}
            aria-label="Command"
          />
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" onClick={addEntry} disabled={disabled} className="w-fit">
        <Plus className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
        Add a variant
      </Button>
    </div>
  );
}

function CommandsEditor({
  teamChecklistId,
  itemId,
  commands,
  isEdited,
  canEdit,
}: {
  teamChecklistId: string;
  itemId: string;
  commands: Record<string, string>;
  isEdited: boolean;
  canEdit: boolean;
}) {
  const toEntries = (map: Record<string, string>) =>
    commandEntries(map).map(([key, value]) => ({ key, value }));

  const [tracked, setTracked] = useState(commands);
  const [entries, setEntries] = useState<CommandDraftEntry[]>(() => toEntries(commands));
  if (!sameCommandsMap(commands, tracked)) {
    setTracked(commands);
    setEntries(toEntries(commands));
  }

  const [state, formAction, pending] = useActionState(updateForkItemCommands, initialState);
  const [revertState, revertAction, revertPending] = useActionState(revertForkItemField, initialState);

  if (!canEdit) {
    return (
      <div className="flex flex-col gap-2">
        {commandEntries(commands).map(([key, command]) => (
          <CommandBlock key={key} label={commandLabel(key)} command={command} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Eyebrow>Commands</Eyebrow>
        {isEdited && (
          <form action={revertAction}>
            <input type="hidden" name="teamChecklistId" value={teamChecklistId} />
            <input type="hidden" name="itemId" value={itemId} />
            <input type="hidden" name="field" value="commands" />
            <Button type="submit" variant="ghost" size="sm" disabled={revertPending}>
              <RotateCcw className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
              Revert to upstream
            </Button>
          </form>
        )}
      </div>
      <form action={formAction} className="flex flex-col gap-2">
        <input type="hidden" name="teamChecklistId" value={teamChecklistId} />
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="entries" value={JSON.stringify(entries)} />
        <CommandEntriesFields entries={entries} onChange={setEntries} disabled={pending} />
        <Button type="submit" size="sm" disabled={pending} className="w-fit">
          {pending ? "Saving…" : "Save commands"}
        </Button>
      </form>
      {(state.error || revertState.error) && (
        <ErrorNote>{state.error ?? revertState.error}</ErrorNote>
      )}
    </div>
  );
}

function AddItemForm({ teamChecklistId }: { teamChecklistId: string }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<CommandDraftEntry[]>([{ key: "all", value: "" }]);
  const [state, formAction, pending] = useActionState(addForkItem, initialState);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      setOpen(false);
      setEntries([{ key: "all", value: "" }]);
    }
    wasPending.current = pending;
  }, [pending, state]);

  if (!open) {
    return (
      <Button type="button" variant="ghost" onClick={() => setOpen(true)} className="w-fit">
        <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
        Add an item
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-md border border-hairline bg-surface p-4"
    >
      <input type="hidden" name="teamChecklistId" value={teamChecklistId} />
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-text-dim" htmlFor="new-item-action">
          Action
        </label>
        <Textarea id="new-item-action" name="action" placeholder="What should the team do?" disabled={pending} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-text-dim" htmlFor="new-item-why">
          Why
        </label>
        <Textarea id="new-item-why" name="why" placeholder="Why does this matter?" disabled={pending} />
      </div>
      <CommandEntriesFields entries={entries} onChange={setEntries} disabled={pending} />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Adding…" : "Add item"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
      {state.error && <ErrorNote>{state.error}</ErrorNote>}
    </form>
  );
}
