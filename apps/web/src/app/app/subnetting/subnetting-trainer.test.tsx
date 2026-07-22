// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, act, fireEvent, render, screen } from "@testing-library/react";

import { SubnettingTrainer } from "./subnetting-trainer";
import { computeSubnet, formatIp } from "@/lib/subnetting/math";

afterEach(() => {
  cleanup();
});

// Forces every generated problem in the round to "which-subnet" (a single
// "Network address" field) so each test can read the given IP/prefix
// straight off the screen and compute the correct answer itself with the
// same pure math the component uses — no need to mock Math.random or guess
// at generated values.
function startWhichSubnetRound(recordQuickRound: (input: unknown) => Promise<unknown>) {
  render(<SubnettingTrainer bestAccuracy={null} recordQuickRound={recordQuickRound as never} />);
  fireEvent.change(screen.getByLabelText("Problem type"), { target: { value: "which-subnet" } });
  fireEvent.click(screen.getByRole("button", { name: "Start" }));
}

function readGiven(): { ip: string; prefix: number } {
  const el = screen.getByText((content, element) => {
    return element?.tagName.toLowerCase() === "p" && /^\d+\.\d+\.\d+\.\d+\/\d+$/.test(content);
  });
  const [ip, prefixStr] = el.textContent!.split("/");
  return { ip: ip!, prefix: Number(prefixStr) };
}

function answerCurrentCorrectly() {
  const { ip, prefix } = readGiven();
  const expected = formatIp(computeSubnet(ip, prefix).network);
  fireEvent.change(screen.getByLabelText("Network address"), { target: { value: expected } });
  fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
}

describe("SubnettingTrainer", () => {
  it("shows every field correct and reveals the worked solution on a correct answer", () => {
    startWhichSubnetRound(vi.fn());
    answerCurrentCorrectly();

    expect(screen.queryByText(/Expected:/)).toBeNull();
    screen.getByText("Worked solution");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("flags the field and reveals the expected value on a wrong answer", () => {
    startWhichSubnetRound(vi.fn());

    fireEvent.change(screen.getByLabelText("Network address"), { target: { value: "1.2.3.4" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));

    screen.getByText(/Expected:/);
    screen.getByRole("button", { name: "Try again" });
  });

  it("'Try again' clears only the wrong field and lets a resubmit fully correct", () => {
    startWhichSubnetRound(vi.fn());

    fireEvent.change(screen.getByLabelText("Network address"), { target: { value: "1.2.3.4" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect((screen.getByLabelText("Network address") as HTMLInputElement).value).toBe("");

    answerCurrentCorrectly();
    expect(screen.queryByText(/Expected:/)).toBeNull();
  });

  it("finishes a quick round by calling recordQuickRound with the seed + collected answers", async () => {
    const recordQuickRound = vi.fn<
      (input: unknown) => Promise<{ accuracy: number; correct: number; total: number; best: number }>
    >();
    recordQuickRound.mockResolvedValue({ accuracy: 100, correct: 5, total: 5, best: 100 });
    startWhichSubnetRound(recordQuickRound);

    for (let i = 0; i < 5; i++) {
      answerCurrentCorrectly();
      const isLast = i === 4;
      const button = screen.getByRole("button", { name: isLast ? "See results" : "Next problem" });
      if (isLast) {
        await act(async () => {
          fireEvent.click(button);
          await Promise.resolve();
          await Promise.resolve();
        });
      } else {
        fireEvent.click(button);
      }
    }

    expect(recordQuickRound).toHaveBeenCalledTimes(1);
    const call = recordQuickRound.mock.calls[0]![0] as {
      seed: number;
      count: number;
      types?: string[];
      answers: unknown[];
    };
    expect(call.count).toBe(5);
    expect(call.types).toEqual(["which-subnet"]);
    expect(call.answers).toHaveLength(5);
    expect(typeof call.seed).toBe("number");
    screen.getByText("5 / 5");
  });
});
