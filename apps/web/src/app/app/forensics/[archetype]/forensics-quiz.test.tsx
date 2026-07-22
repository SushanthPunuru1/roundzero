// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, act, fireEvent, render, screen } from "@testing-library/react";

import { ForensicsQuiz } from "./forensics-quiz";

// The fix this guards against: answering a question wrong used to strand
// the student on that wrong answer for the rest of the set — retrying meant
// abandoning the set and re-entering it. gradeForensicsQuestion is stateless
// per call and completeForensicsSet already re-grades from whatever the
// client last reported per question, so a "Try again" affordance that just
// resets the in-place input, with no changes to either action, is enough to
// let a retried answer supersede the original wrong one.
const gradeForensicsQuestion = vi.fn();
const completeForensicsSet = vi.fn(
  async (_input: { archetypeKey: string; answers: { questionId: string; submitted: string }[] }) => ({
    score: 100,
    correct: 1,
    total: 1,
    enqueued: 0,
  }),
);

vi.mock("./actions", () => ({
  gradeForensicsQuestion: (input: { questionId: string; submitted: string }) =>
    gradeForensicsQuestion(input),
  completeForensicsSet: (input: { archetypeKey: string; answers: { questionId: string; submitted: string }[] }) =>
    completeForensicsSet(input),
}));

afterEach(() => {
  cleanup();
  gradeForensicsQuestion.mockReset();
  completeForensicsSet.mockClear();
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

describe("ForensicsQuiz retry flow", () => {
  it("offers Try again on an incorrect answer, and lets the student re-attempt in place", async () => {
    gradeForensicsQuestion.mockResolvedValueOnce({
      status: "incorrect",
      answer: "hi",
      technique: "base64 -d",
      why: "why",
    });

    render(<ForensicsQuiz archetypeKey="decoding" questions={QUESTIONS} />);
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
    gradeForensicsQuestion.mockResolvedValueOnce({
      status: "correct",
      answer: "hi",
      technique: "base64 -d",
      why: "why",
    });

    render(<ForensicsQuiz archetypeKey="decoding" questions={QUESTIONS} />);
    await submitAnswer("hi");

    screen.getByText("Correct");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("scores the set on the FINAL retried answer, not the original wrong one", async () => {
    gradeForensicsQuestion
      .mockResolvedValueOnce({ status: "incorrect", answer: "hi", technique: "t", why: "w" })
      .mockResolvedValueOnce({ status: "correct", answer: "hi", technique: "t", why: "w" });

    render(<ForensicsQuiz archetypeKey="decoding" questions={QUESTIONS} />);

    await submitAnswer("wrong guess");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await submitAnswer("hi");

    screen.getByText("Correct");
    fireEvent.click(screen.getByRole("button", { name: "See results" }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(completeForensicsSet).toHaveBeenCalledTimes(1);
    expect(completeForensicsSet).toHaveBeenCalledWith({
      archetypeKey: "decoding",
      answers: [{ questionId: "q1", submitted: "hi" }],
    });
    screen.getByText("100%");
  });
});
