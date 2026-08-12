// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { NextStepHero, NextStepRow, type NextStepView } from "./next-step-card";

afterEach(cleanup);

function step(over: Partial<NextStepView> = {}): NextStepView {
  return {
    kind: "lesson",
    title: "What an operating system actually is",
    reason: "Everything else is a detail of this.",
    pillar: "Foundations",
    minutes: 6,
    href: "/app/lessons/what-is-an-os",
    status: "ready",
    ...over,
  };
}

const LAB = step({
  kind: "lab",
  title: "Practice Linux lab",
  reason: "You've got the fundamentals — harden a real machine when you can run it locally.",
  pillar: "Linux",
  minutes: null,
  href: "/app/lab",
  status: "available-when-runnable",
});

// The regression these guard: the card rendered a "Runs locally" chip INSIDE
// a live <Link>, so the whole row was clickable and dead-ended on the
// production deploy — the exact thing the available-when-runnable status
// exists to prevent. This state can't be reached by a normal account without
// a lab-ready track, so it gets asserted here rather than clicked through.
describe("a step that can't be started on this deploy", () => {
  it("renders the row as a non-link — no anchor, no href to dead-end on", () => {
    const { container } = render(<NextStepRow step={LAB} />);
    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("Runs locally")).toBeTruthy();
    expect(screen.getByText("Practice Linux lab")).toBeTruthy();
  });

  it("renders the hero without a primary action, offering only an explainer link", () => {
    const { container } = render(<NextStepHero step={LAB} />);
    expect(screen.queryByText("Open lab")).toBeNull();
    expect(screen.getByText("Runs locally")).toBeTruthy();

    const links = [...container.querySelectorAll("a")];
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute("href")).toBe("/app/lab");
    expect(links[0]!.textContent).toContain("How to run it");
  });

  it("shows no trailing arrow, so nothing reads as 'click through here'", () => {
    const { container } = render(<NextStepRow step={LAB} />);
    expect(container.querySelector(".lucide-arrow-right")).toBeNull();
  });
});

describe("a ready step", () => {
  it("renders the row as a real link to its href", () => {
    const { container } = render(<NextStepRow step={step()} />);
    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("/app/lessons/what-is-an-os");
  });

  it("gives the hero a primary action naming what happens, not 'Continue'", () => {
    render(<NextStepHero step={step()} />);
    const action = screen.getByText("Start lesson");
    expect(action.closest("a")!.getAttribute("href")).toBe("/app/lessons/what-is-an-os");
  });

  it("names the action per kind", () => {
    render(<NextStepHero step={step({ kind: "drill", title: "Daily drill", href: "/app/drill" })} />);
    expect(screen.getByText("Start drill")).toBeTruthy();
  });
});

describe("the eyebrow carries pillar and honest cost", () => {
  it("shows pillar and minutes when a lesson authors them", () => {
    render(<NextStepRow step={step()} />);
    expect(screen.getByText("Foundations")).toBeTruthy();
    expect(screen.getByText("6 min")).toBeTruthy();
  });

  it("omits the time entirely rather than inventing one when minutes is null", () => {
    const { container } = render(
      <NextStepRow step={step({ kind: "drill", pillar: "Recall", minutes: null })} />,
    );
    expect(screen.getByText("Recall")).toBeTruthy();
    expect(container.textContent).not.toContain("min");
  });

  it("keeps pillar and minutes at every width — they are the point of the eyebrow", () => {
    // Regression: these were `hidden sm:flex`, which hid the information
    // itself below 640px rather than merely reflowing it.
    const { container } = render(<NextStepRow step={step()} />);
    const meta = screen.getByText("Foundations").parentElement!;
    expect(meta.className).not.toContain("hidden");
    expect(container.textContent).toContain("6 min");
  });
});

describe("sequence signal", () => {
  it("renders the ordinal so a stack of rows reads as an order, not a menu", () => {
    render(<NextStepRow step={step()} ordinal={2} />);
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("omits the ordinal when a row is shown alone (inline completion surfaces)", () => {
    const { container } = render(<NextStepRow step={step()} />);
    expect(container.textContent).not.toMatch(/^\s*\d/);
  });
});

describe("hero accent hierarchy", () => {
  // Two accent-bordered cards stacked (the placement invite and this hero)
  // made neither one the answer to "what now".
  it("drops the accent border when something above it owns the primary slot", () => {
    const { container } = render(<NextStepHero step={step()} muted />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("border-hairline");
    expect(card.className).not.toContain("border-accent");
  });

  it("keeps the accent border when it is the primary thing on the screen", () => {
    const { container } = render(<NextStepHero step={step()} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("border-accent/30");
  });
});
