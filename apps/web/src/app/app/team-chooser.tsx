"use client";

import { useActionState, useState } from "react";
import { AlertCircle, ArrowLeft, KeyRound, Users } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
} from "@roundzero/ui";

import { createTeam, joinTeam, type TeamActionState } from "./actions";

type Mode = "choice" | "create" | "join";

const initialState: TeamActionState = {};

export function TeamChooser() {
  const [mode, setMode] = useState<Mode>("choice");

  if (mode === "create") {
    return <CreateTeamCard onBack={() => setMode("choice")} />;
  }
  if (mode === "join") {
    return <JoinTeamCard onBack={() => setMode("choice")} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <Users
            className="size-5 text-text-dim"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <CardTitle>Create a team</CardTitle>
          <CardDescription>
            Start a new roster, set your division, and get a join code for
            your teammates.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            className="w-full"
            onClick={() => setMode("create")}
          >
            Create a team
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <KeyRound
            className="size-5 text-text-dim"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <CardTitle>Join a team</CardTitle>
          <CardDescription>
            Have a join code from your coach? Use it to join their roster.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setMode("join")}
          >
            Join a team
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex w-fit items-center gap-1 text-xs text-text-dim transition-colors duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:text-text"
    >
      <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      Back
    </button>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-hairline bg-surface-2 p-3">
      <AlertCircle
        className="mt-0.5 size-4 shrink-0 text-text-dim"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <p className="text-sm text-text">{message}</p>
    </div>
  );
}

function CreateTeamCard({ onBack }: { onBack: () => void }) {
  const [state, formAction, pending] = useActionState(createTeam, initialState);

  return (
    <Card>
      <CardHeader>
        <BackButton onBack={onBack} />
        <CardTitle>Create a team</CardTitle>
        <CardDescription>
          You&apos;ll be the coach. You can invite teammates with a join code
          afterward.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm text-text-dim">
              Team name
            </label>
            <Input
              id="name"
              name="name"
              required
              placeholder="Wildcats CyberPatriot"
              disabled={pending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="division" className="text-sm text-text-dim">
              Division
            </label>
            <Select
              id="division"
              name="division"
              required
              defaultValue="OPEN"
              disabled={pending}
            >
              <option value="OPEN">Open</option>
              <option value="ALL_SERVICE">All-Service</option>
              <option value="MIDDLE_SCHOOL">Middle school</option>
            </Select>
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create team"}
          </Button>
          {state.error && <ErrorNote message={state.error} />}
        </form>
      </CardContent>
    </Card>
  );
}

function JoinTeamCard({ onBack }: { onBack: () => void }) {
  const [state, formAction, pending] = useActionState(joinTeam, initialState);

  return (
    <Card>
      <CardHeader>
        <BackButton onBack={onBack} />
        <CardTitle>Join a team</CardTitle>
        <CardDescription>
          Enter the join code your coach shared with you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="code" className="text-sm text-text-dim">
              Join code
            </label>
            <Input
              id="code"
              name="code"
              required
              placeholder="cme1a2b3c4d5e6f7g8h9"
              className="font-mono"
              disabled={pending}
            />
          </div>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Joining…" : "Join team"}
          </Button>
          {state.error && <ErrorNote message={state.error} />}
        </form>
      </CardContent>
    </Card>
  );
}
