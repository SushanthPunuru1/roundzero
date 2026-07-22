// Pure worked-solution builder. Turns a Problem into the binary breakdown +
// step-by-step prose the trainer reveals on submit — the spec's whole point
// ("that's where the learning is"), not just a bare answer. No DB/framework
// imports; explain.test.ts pins the shape and a few known cases.

import { type Problem } from "./generate";
import { computeSubnet, formatIp, ipToBinary, parseIp } from "./math";

export interface WorkedSolution {
  ipBinary: string;
  maskBinary: string;
  networkBinary: string;
  broadcastBinary: string;
  prefix: number;
  hostBits: number;
  blockSize: number;
  steps: string[];
  /** Set only for /31 or /32 results — the classic usable-host formula gives
   * 0, but both edge cases have a real-world exception worth teaching. */
  edgeCaseNote?: string;
}

function edgeCaseNote(prefix: number): string | undefined {
  if (prefix === 31) {
    return "A /31 has no separate network or broadcast address (RFC 3021) — both addresses are usable, typically for a point-to-point link.";
  }
  if (prefix === 32) {
    return "A /32 identifies a single host — there's no broadcast address and no other host to route to.";
  }
  return undefined;
}

export function explainProblem(problem: Problem): WorkedSolution {
  const ip = parseIp(problem.ip);
  if (ip === null) throw new Error(`explainProblem: invalid ip "${problem.ip}"`);
  const facts = computeSubnet(ip, problem.prefix);

  const steps: string[] = [];
  steps.push(
    `${formatIp(ip)} in binary: ${ipToBinary(ip)} — the first ${problem.prefix} bits are the network portion, the remaining ${facts.hostBits} bits are the host portion.`,
  );
  steps.push(
    `/${problem.prefix} as a mask: ${formatIp(facts.mask)} (${ipToBinary(facts.mask)}).`,
  );
  steps.push(
    `Network address = IP AND mask, so every host bit is forced to 0: ${formatIp(facts.network)}.`,
  );
  steps.push(
    `Broadcast address = network with every host bit forced to 1: ${formatIp(facts.broadcast)}.`,
  );

  if (facts.usableHosts > 0) {
    steps.push(
      `Usable host range: ${formatIp(facts.firstHost!)} - ${formatIp(facts.lastHost!)} (network + 1 through broadcast - 1).`,
    );
  }

  steps.push(
    `Block size = 2^${facts.hostBits} = ${facts.blockSize} addresses; usable hosts = ${facts.blockSize} - 2 = ${facts.usableHosts}.`,
  );

  if (problem.type === "vlsm-fit" && problem.requiredHosts !== undefined) {
    steps.push(
      `Needed ${problem.requiredHosts} usable hosts, so the smallest block whose 2^h - 2 covers that is h=${facts.hostBits} host bits — prefix /${problem.prefix}.`,
    );
  }

  const note = edgeCaseNote(problem.prefix);
  if (note) steps.push(note);

  return {
    ipBinary: ipToBinary(ip),
    maskBinary: ipToBinary(facts.mask),
    networkBinary: ipToBinary(facts.network),
    broadcastBinary: ipToBinary(facts.broadcast),
    prefix: problem.prefix,
    hostBits: facts.hostBits,
    blockSize: facts.blockSize,
    steps,
    edgeCaseNote: note,
  };
}
