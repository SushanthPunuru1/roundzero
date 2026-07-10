import { Button } from "@roundzero/ui";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="text-xs tracking-[0.06em] text-text-dim uppercase">
        Phase 1 · Milestone 1
      </p>
      <h1 className="max-w-xl text-2xl font-semibold text-text">
        RoundZero — skeleton with a pulse.
      </h1>
      <p className="max-w-md text-sm leading-6 text-text-dim">
        Monorepo, Tailwind tokens, and <code className="font-mono">@roundzero/ui</code>{" "}
        are wired up. Auth, teams, taxonomy sync, and lesson rendering are
        next.
      </p>
      <Button>Placeholder action</Button>
    </main>
  );
}
