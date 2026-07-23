import { describe, expect, it } from "vitest";
import {
  NOT_SURE,
  QUESTIONS_PER_DOMAIN,
  TOTAL_QUESTIONS,
  earlyExitLevels,
  gradeAnswer,
  mapLevels,
  nextStep,
  recordAnswer,
  type PlacementAnswer,
} from "./ladder";
import {
  PLACEMENT_DOMAINS,
  PLACEMENT_TIERS,
  type DesiredPlacementQuestion,
  type PlacementDomain,
  type PlacementTier,
} from "./parse";

const CORRECT = 0;
const WRONG = 1;

function makeQuestion(domain: PlacementDomain, tier: PlacementTier, n: number): DesiredPlacementQuestion {
  return {
    id: `placement.${domain}.${tier}.${n}`,
    domain,
    tier,
    skillNodeId: "foundations.core.os-basics",
    prompt: `${domain} ${tier} #${n}`,
    options: ["correct", "wrong"],
    answer: 0,
    why: "why",
    sortOrder: n,
  };
}

/** Mirrors the real content's shape: 3 foundations + 2 standard + 2 advanced
 * per domain — matches validatePlacementCoverage's floor with margin. */
function buildBank(): DesiredPlacementQuestion[] {
  const bank: DesiredPlacementQuestion[] = [];
  for (const domain of PLACEMENT_DOMAINS) {
    for (const tier of PLACEMENT_TIERS) {
      const count = tier === "foundations" ? 3 : 2;
      for (let n = 0; n < count; n++) bank.push(makeQuestion(domain, tier, n));
    }
  }
  return bank;
}

function play(choices: number[], bank = buildBank()): PlacementAnswer[] {
  const history: PlacementAnswer[] = [];
  for (const choice of choices) {
    const step = nextStep(history, bank);
    if (step.done) throw new Error("ran out of questions before all choices were consumed");
    history.push(recordAnswer(bank, step.question.id, choice));
  }
  return history;
}

describe("gradeAnswer", () => {
  const bank = buildBank();
  const question = bank[0]!; // answer: 0

  it("is correct only for the authored answer index", () => {
    expect(gradeAnswer(question, 0)).toBe(true);
    expect(gradeAnswer(question, 1)).toBe(false);
  });

  it("treats NOT_SURE as never correct", () => {
    expect(gradeAnswer(question, NOT_SURE)).toBe(false);
  });
});

describe("recordAnswer", () => {
  it("re-derives domain/tier/correctness from the bank, never trusting the caller", () => {
    const bank = buildBank();
    const question = bank.find((q) => q.domain === "linux" && q.tier === "standard")!;
    const answer = recordAnswer(bank, question.id, 0);
    expect(answer).toEqual({
      questionId: question.id,
      domain: "linux",
      tier: "standard",
      choice: 0,
      correct: true,
    });
  });

  it("throws on an unknown question id", () => {
    expect(() => recordAnswer(buildBank(), "placement.nonexistent", 0)).toThrow(/unknown placement question id/);
  });
});

describe("nextStep — ladder progression", () => {
  it("starts every check at the foundations domain, foundations tier", () => {
    const step = nextStep([], buildBank());
    expect(step.done).toBe(false);
    if (step.done) return;
    expect(step.question.domain).toBe("foundations");
    expect(step.question.tier).toBe("foundations");
  });

  it("steps a domain's difficulty up one tier after a correct answer, down one after a wrong one", () => {
    const bank = buildBank();
    const history = play([CORRECT], bank);
    const step2 = nextStep(history, bank);
    expect(step2.done).toBe(false);
    if (step2.done) return;
    expect(step2.question.domain).toBe("foundations");
    expect(step2.question.tier).toBe("standard");

    history.push(recordAnswer(bank, step2.question.id, WRONG));
    const step3 = nextStep(history, bank);
    expect(step3.done).toBe(false);
    if (step3.done) return;
    expect(step3.question.tier).toBe("foundations");
  });

  it("clamps at foundations — a second wrong answer in a row stays at foundations", () => {
    const bank = buildBank();
    const history = play([WRONG, WRONG], bank);
    const step3 = nextStep(history, bank);
    expect(step3.done).toBe(false);
    if (step3.done) return;
    expect(step3.question.tier).toBe("foundations");
  });

  it("clamps at advanced — a second correct answer in a row stays at advanced", () => {
    const bank = buildBank();
    const history = play([CORRECT, CORRECT], bank);
    const step3 = nextStep(history, bank);
    expect(step3.done).toBe(false);
    if (step3.done) return;
    expect(step3.question.tier).toBe("advanced");
  });

  it("moves to the next domain after QUESTIONS_PER_DOMAIN questions, foundations block first", () => {
    const bank = buildBank();
    const history = play(Array(QUESTIONS_PER_DOMAIN).fill(CORRECT) as number[], bank);
    const step = nextStep(history, bank);
    expect(step.done).toBe(false);
    if (step.done) return;
    expect(step.question.domain).toBe("linux");
    expect(step.question.tier).toBe("foundations");
  });

  it("never repeats a question across a full run", () => {
    const bank = buildBank();
    const history = play(Array(TOTAL_QUESTIONS).fill(CORRECT) as number[], bank);
    const ids = history.map((a) => a.questionId);
    expect(new Set(ids).size).toBe(TOTAL_QUESTIONS);
  });

  it("terminates after exactly TOTAL_QUESTIONS and returns done with levels", () => {
    const bank = buildBank();
    const history = play(Array(TOTAL_QUESTIONS).fill(CORRECT) as number[], bank);
    expect(history).toHaveLength(TOTAL_QUESTIONS);
    const step = nextStep(history, bank);
    expect(step.done).toBe(true);
    if (!step.done) return;
    expect(Object.keys(step.levels).sort()).toEqual([...PLACEMENT_DOMAINS].sort());
  });

  it("falls back to the nearest available tier if the exact tier is exhausted in that domain", () => {
    const bank = buildBank().filter((q) => !(q.domain === "foundations" && q.tier === "advanced"));
    const history = play([CORRECT, CORRECT], bank); // would normally reach "advanced"
    const step3 = nextStep(history, bank);
    expect(step3.done).toBe(false);
    if (step3.done) return;
    expect(step3.question.domain).toBe("foundations");
    expect(step3.question.tier).toBe("standard"); // nearest tier to the missing "advanced"
  });

  it("ends the check early (done:true) if a whole domain's bank is exhausted, without crashing", () => {
    const bank = buildBank().filter((q) => q.domain !== "networking");
    const history = play(Array(QUESTIONS_PER_DOMAIN * 3).fill(CORRECT) as number[], bank); // foundations+linux+windows
    const step = nextStep(history, bank); // would be networking's turn — none exist
    expect(step.done).toBe(true);
    if (!step.done) return;
    expect(step.levels.networking).toBe("FOUNDATIONS"); // graceful floor, not a crash
  });
});

describe("nextStep — early-exit offer", () => {
  it("does not offer an early exit when the first question is answered correctly", () => {
    const bank = buildBank();
    const history = play([CORRECT], bank);
    const step = nextStep(history, bank);
    expect(step.done).toBe(false);
    if (step.done) return;
    expect(step.offerEarlyExit).toBe(false);
  });

  it("offers an early exit right after a wrong first answer", () => {
    const bank = buildBank();
    const history = play([WRONG], bank);
    const step = nextStep(history, bank);
    expect(step.done).toBe(false);
    if (step.done) return;
    expect(step.offerEarlyExit).toBe(true);
  });

  it("offers an early exit right after an 'I'm not sure yet' first answer", () => {
    const bank = buildBank();
    const history = play([NOT_SURE], bank);
    const step = nextStep(history, bank);
    expect(step.done).toBe(false);
    if (step.done) return;
    expect(step.offerEarlyExit).toBe(true);
  });

  it("never offers again after the first question, even on a later miss", () => {
    const bank = buildBank();
    const history = play([WRONG, WRONG], bank);
    const step = nextStep(history, bank);
    expect(step.done).toBe(false);
    if (step.done) return;
    expect(step.offerEarlyExit).toBe(false);
  });
});

describe("mapLevels", () => {
  it("floors every domain at FOUNDATIONS with no history at all", () => {
    const levels = mapLevels([]);
    for (const domain of PLACEMENT_DOMAINS) expect(levels[domain]).toBe("FOUNDATIONS");
  });

  it("places every domain at FOUNDATIONS when every answer was wrong", () => {
    const history = play(Array(TOTAL_QUESTIONS).fill(WRONG) as number[]);
    const levels = mapLevels(history);
    for (const domain of PLACEMENT_DOMAINS) expect(levels[domain]).toBe("FOUNDATIONS");
  });

  it("places every domain at FOUNDATIONS when every answer was 'not sure'", () => {
    const history = play(Array(TOTAL_QUESTIONS).fill(NOT_SURE) as number[]);
    const levels = mapLevels(history);
    for (const domain of PLACEMENT_DOMAINS) expect(levels[domain]).toBe("FOUNDATIONS");
  });

  it("places every domain at ADVANCED when every answer was correct", () => {
    const history = play(Array(TOTAL_QUESTIONS).fill(CORRECT) as number[]);
    const levels = mapLevels(history);
    for (const domain of PLACEMENT_DOMAINS) expect(levels[domain]).toBe("ADVANCED");
  });

  it("takes the highest tier ever answered correctly, not wherever the pointer ends up", () => {
    // correct (tier 0->1), wrong (tier 1, misses standard, ->0), correct
    // (tier 0->1 again). The pointer ends up pointing at "standard" for a
    // 4th question that never comes — but standard was never actually
    // answered correctly, only foundations was (twice). Placement must
    // reflect what was demonstrated, not the unused pointer position.
    const history = play([CORRECT, WRONG, CORRECT]);
    const levels = mapLevels(history);
    expect(levels.foundations).toBe("FOUNDATIONS");
  });
});

describe("earlyExitLevels", () => {
  it("places every domain at FOUNDATIONS", () => {
    const levels = earlyExitLevels();
    for (const domain of PLACEMENT_DOMAINS) expect(levels[domain]).toBe("FOUNDATIONS");
  });
});
