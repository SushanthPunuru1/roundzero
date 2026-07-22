// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, act, fireEvent, render, screen } from "@testing-library/react";

import { QuizRunner } from "./quiz-runner";

// The fix this guards against (originally forensics-only, DECISIONS 032):
// answering a question wrong used to strand the student on that wrong
// answer for the rest of the set — retrying meant abandoning the set and
// re-entering it. onGrade is stateless per call and onComplete already
// re-grades from whatever the client last reported per question, so a "Try
// again" affordance that just resets the in-place input, with no changes to
// either callback, is enough to let a retried answer supersede the original
// wrong one. This now guards the shared engine every quiz (forensics,
// networking, future ones) is built on.

const onGrade = vi.fn();
const onComplete = vi.fn(
  async (_input: { answers: { questionId: string; submitted: string }[] }) => ({
    score: 100,
    correct: 1,
    total: 1,
    enqueued: 0,
  }),
);

afterEach(() => {
  cleanup();
  onGrade.mockReset();
  onComplete.mockClear();
});

const QUESTIONS = [{ id: "q1", prompt: "Decode the string.", given: "aGk=" }];

async function submitAnswer(value: string) {
  fireEvent.change(screen.getByLabelText("Your answer"), { target: { value } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function renderRunner() {
  render(
    <QuizRunner
      questions={QUESTIONS}
      onGrade={onGrade}
      onComplete={onComplete}
      backHref="/app/forensics"
      backLabel="Back to forensics"
    />,
  );
}

describe("QuizRunner retry flow", () => {
  it("offers Try again on an incorrect answer, and lets the student re-attempt in place", async () => {
    onGrade.mockResolvedValueOnce({
      status: "incorrect",
      answer: "hi",
      technique: "base64 -d",
      why: "why",
    });

    renderRunner();
    await submitAnswer("wrong guess");

    screen.getByText("Incorrect");
    const retryButton = screen.getByRole("button", { name: "Try again" });

    fireEvent.click(retryButton);

    // Back to the answer form, for the SAME question — not advanced, not
    // stuck on the wrong-answer feedback.
    screen.getByText("Question 1 of 1");
    expect(screen.queryByText("Incorrect")).toBeNull();
    expect((screen.getByLabelText("Your answer") as HTMLInputElement).value).toBe("");
  });

  it("does not offer Try again once the answer is correct", async () => {
    onGrade.mockResolvedValueOnce({
      status: "correct",
      answer: "hi",
      technique: "base64 -d",
      why: "why",
    });

    renderRunner();
    await submitAnswer("hi");

    screen.getByText("Correct");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("scores the set on the FINAL retried answer, not the original wrong one", async () => {
    onGrade
      .mockResolvedValueOnce({ status: "incorrect", answer: "hi", technique: "t", why: "w" })
      .mockResolvedValueOnce({ status: "correct", answer: "hi", technique: "t", why: "w" });

    renderRunner();

    await submitAnswer("wrong guess");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await submitAnswer("hi");

    screen.getByText("Correct");
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({
      answers: [{ questionId: "q1", submitted: "hi" }],
    });
    screen.getByText("100%");
  });

  it("renders without an evidence block when a question has no `given` (networking-style question)", async () => {
    const { container } = render(
      <QuizRunner
        questions={[{ id: "q1", prompt: "What port does RDP use?" }]}
        onGrade={onGrade}
        onComplete={onComplete}
        backHref="/app/networking"
        backLabel="Back to networking"
      />,
    );
    screen.getByText("What port does RDP use?");
    expect(container.querySelector("pre")).toBeNull();
  });
});
