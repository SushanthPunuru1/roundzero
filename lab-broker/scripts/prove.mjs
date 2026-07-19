#!/usr/bin/env node
// One-command end-to-end proof of the whole lab-broker loop, against a real
// Docker daemon and the real linux-practice image — no browser needed, this
// drives the WebSocket terminal exactly the way the browser will. Mirrors
// the shape of agent/scripts/prove.sh: self-asserting, non-zero exit on any
// mismatch.
//
// Prerequisites (see README.md): `rz-practice:latest` built and
// agent/rzagent built (both already produced by `bash agent/scripts/prove.sh`).
//
// Usage: npm run prove   (from lab-broker/)

import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import WebSocket from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BROKER_DIR = path.resolve(__dirname, "..");
const HOST = "127.0.0.1";
const PORT = 8081; // distinct from the default dev port so this can run alongside `npm run dev`
const BASE_URL = `http://${HOST}:${PORT}`;

let fail = 0;
function assertEq(label, expected, actual) {
  if (expected !== actual) {
    console.log(`  FAIL: ${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    fail = 1;
  } else {
    console.log(`  ok:   ${label} == ${JSON.stringify(actual)}`);
  }
}
function assertTrue(label, cond) {
  if (!cond) {
    console.log(`  FAIL: ${label}`);
    fail = 1;
  } else {
    console.log(`  ok:   ${label}`);
  }
}

function tsxCli() {
  // Spawn `node <tsx cli.mjs>` directly rather than the node_modules/.bin
  // shim: on Windows the shim is a .cmd file, which node's spawn() can't
  // exec without shell:true — and shell:true here would hand us the cmd.exe
  // wrapper's PID instead of the real node process's, so killing it later
  // (idle cleanup, test teardown) would leave the actual broker orphaned
  // holding the port/containers.
  return path.join(BROKER_DIR, "node_modules", "tsx", "dist", "cli.mjs");
}

async function startBroker() {
  const child = spawn(process.execPath, [tsxCli(), "src/index.ts"], {
    cwd: BROKER_DIR,
    env: { ...process.env, HOST, PORT: String(PORT) },
  });

  let buffer = "";
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("broker did not report listening within 10s")), 10_000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      if (buffer.includes("listening on")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`broker exited early (code ${code})\n${buffer}`));
    });
  });

  await ready;
  return child;
}

async function stopBroker(child) {
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const t = setTimeout(resolve, 3000);
    child.on("exit", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

async function createLab() {
  const res = await fetch(`${BASE_URL}/labs`, { method: "POST" });
  if (res.status !== 201) throw new Error(`POST /labs -> ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return body.id;
}

async function scoreLab(id) {
  const res = await fetch(`${BASE_URL}/labs/${id}/score`, { method: "POST" });
  if (res.status !== 200) throw new Error(`POST /labs/${id}/score -> ${res.status}: ${await res.text()}`);
  return res.json();
}

async function deleteLab(id) {
  return fetch(`${BASE_URL}/labs/${id}`, { method: "DELETE" });
}

function checkFor(report, id) {
  return report.checks.find((c) => c.id === id);
}

/** Opens the terminal WS, runs `commands` in order (each followed by a
 * unique sentinel echo so we know it finished before moving on), then
 * resolves. This is exactly the protocol apps/web's LabConsole speaks. */
async function runShellCommands(id, commands) {
  const ws = new WebSocket(`ws://${HOST}:${PORT}/labs/${id}/term`);
  let buffer = "";
  ws.on("message", (data, isBinary) => {
    if (process.env.RZ_DEBUG) console.log("DEBUG message", { isBinary, len: data.length, text: data.toString("utf8").slice(0, 200) });
    if (isBinary) buffer += data.toString("utf8");
  });
  ws.on("close", (code, reason) => {
    if (process.env.RZ_DEBUG) console.log("DEBUG ws close", code, reason.toString());
  });
  ws.on("error", (err) => {
    if (process.env.RZ_DEBUG) console.log("DEBUG ws error", err);
  });

  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
  });
  ws.send(JSON.stringify({ type: "resize", cols: 120, rows: 30 }));

  function waitFor(marker, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const poll = setInterval(() => {
        if (buffer.includes(marker)) {
          clearInterval(poll);
          resolve();
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(poll);
          reject(new Error(`timed out waiting for "${marker}" in shell output`));
        }
      }, 100);
    });
  }

  // Prime the shell: bash -l can take a beat to print its first prompt.
  ws.send(Buffer.from("echo RZ_SHELL_READY\n"));
  await waitFor("RZ_SHELL_READY");

  for (let i = 0; i < commands.length; i++) {
    const marker = `RZ_STEP_${i}_DONE`;
    ws.send(Buffer.from(`${commands[i]}\n`));
    ws.send(Buffer.from(`echo ${marker}\n`));
    await waitFor(marker);
  }

  ws.close();
}

async function main() {
  console.log("==> Checking rz-practice:latest image is built");
  const images = execFileSync("docker", ["images", "-q", "rz-practice:latest"]).toString().trim();
  if (!images) {
    console.error("rz-practice:latest not found. Run: bash agent/scripts/prove.sh");
    process.exit(1);
  }

  console.log("==> Starting lab-broker");
  const broker = await startBroker();

  let labId;
  try {
    console.log("\n=== STATE 1 — launch a lab, score it fresh (unfixed) ===");
    labId = await createLab();
    console.log(`  lab id: ${labId}`);
    const fresh = await scoreLab(labId);
    assertEq("fresh totalPossible", 100, fresh.totalPossible);
    assertEq("fresh uid0-backdoor pass", false, checkFor(fresh, "uid0-backdoor")?.pass);
    assertEq("fresh ufw-active pass", false, checkFor(fresh, "ufw-active")?.pass);
    const freshEarned = fresh.totalEarned;

    console.log("\n=== STATE 2 — run real fixes through the browser-facing terminal WS ===");
    await runShellCommands(labId, [
      "userdel -f backdoor", // fixes uid0-backdoor, +12
      "ufw --force enable", // fixes ufw-active, +10
    ]);

    console.log("\n=== STATE 3 — re-score: the fixes must be reflected ===");
    const fixed = await scoreLab(labId);
    assertEq("fixed uid0-backdoor pass", true, checkFor(fixed, "uid0-backdoor")?.pass);
    assertEq("fixed ufw-active pass", true, checkFor(fixed, "ufw-active")?.pass);
    assertEq("score increased by exactly the two fixes (+22)", freshEarned + 22, fixed.totalEarned);

    console.log("\n=== STATE 4 — stop the lab; container must be gone ===");
    const delRes = await deleteLab(labId);
    assertEq("DELETE /labs/:id status", 204, delRes.status);
    const stillThere = execFileSync("docker", ["ps", "-a", "-q", "--filter", `name=rz-lab-${labId}`])
      .toString()
      .trim();
    assertTrue("container removed from docker ps -a", stillThere === "");
    labId = undefined;
  } finally {
    if (labId) {
      console.log(`cleanup: force-removing leftover lab ${labId}`);
      await deleteLab(labId).catch(() => {});
    }
    await stopBroker(broker);
  }

  console.log();
  if (fail) {
    console.log("PROVE.MJS: FAILED — one or more assertions above did not hold.");
    process.exit(1);
  }
  console.log("PROVE.MJS: the full launch -> shell -> fix -> score -> stop loop works.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
