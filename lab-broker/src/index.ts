import { loadConfig } from "./config";
import { DockerClient } from "./docker";
import { LabRegistry } from "./registry";
import { createServer } from "./server";

const config = loadConfig();

const docker = new DockerClient({
  image: config.image,
  rzagentBin: config.rzagentBin,
  checksPath: config.checksPath,
});

const registry = new LabRegistry({
  driver: docker,
  maxLabs: config.maxLabs,
  idleTimeoutMs: config.idleTimeoutMs,
});

const server = createServer({ registry, docker });

server.listen(config.port, config.host, () => {
  console.log(`lab-broker listening on http://${config.host}:${config.port}`);
  console.log(`  image:        ${config.image}`);
  console.log(`  rzagent bin:  ${config.rzagentBin}`);
  console.log(`  checks file:  ${config.checksPath}`);
  console.log(`  idle timeout: ${config.idleTimeoutMs / 60_000} min, max labs: ${config.maxLabs}`);
});

const sweepInterval = setInterval(() => {
  registry.sweep().then((removed) => {
    for (const id of removed) {
      console.log(`lab-broker: idle-swept lab ${id}`);
    }
  }).catch((err: unknown) => {
    console.error("lab-broker: idle sweep failed", err);
  });
}, 30_000);

async function shutdown(signal: string): Promise<void> {
  console.log(`lab-broker: received ${signal}, cleaning up tracked containers…`);
  clearInterval(sweepInterval);
  await registry.removeAll();
  server.close(() => process.exit(0));
  // Force-exit if close hangs (e.g. a WS connection never drains).
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
