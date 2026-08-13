"use client";

import { useActionState } from "react";
import { Button, ErrorNote } from "@roundzero/ui";

import { createFork, type ChecklistActionState } from "../actions";

const initialState: ChecklistActionState = {};

export function CreateForkButton({ templateId }: { templateId: string }) {
  const [state, formAction, pending] = useActionState(createFork, initialState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-2">
      <input type="hidden" name="templateId" value={templateId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Customizing…" : "Customize for your team"}
      </Button>
      {state.error && <ErrorNote>{state.error}</ErrorNote>}
    </form>
  );
}
