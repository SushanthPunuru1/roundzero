// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { CountUp } from "@roundzero/ui";

// DESIGN.md: "score count-ups ... are enhancement only: the final value ...
// must be the at-rest DOM state, correct with JS or motion disabled." The
// debrief's headline score is a CountUp — this guards that its synchronous
// (pre-effect) render already shows the true final value, not 0 or a
// mid-animation number, so a page that never gets to run the rAF loop (JS
// disabled, or reduced motion) is still correct.
afterEach(cleanup);

describe("CountUp", () => {
  it("renders the final value synchronously, before any animation effect runs", () => {
    render(<CountUp value={62} />);
    expect(screen.getByText("62")).not.toBeNull();
  });

  it("renders 0 correctly (not blank/NaN) as the at-rest state", () => {
    render(<CountUp value={0} />);
    expect(screen.getByText("0")).not.toBeNull();
  });
});
