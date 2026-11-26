import { spawn } from "node:child_process";
import process from "node:process";

const npmCli = process.env.npm_execpath;
if (!npmCli) {
  throw new Error("Run the development server with `npm run dev`.");
}

const services = ["backend", "frontend"];
const children = services.map((directory) =>
  spawn(process.execPath, [npmCli, "--prefix", directory, "run", "dev"], {
    stdio: "inherit",
  }),
);
let stopping = false;

function stopServices(signal) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill(signal);
  }
}

process.on("SIGINT", () => stopServices("SIGINT"));
process.on("SIGTERM", () => stopServices("SIGTERM"));

for (const child of children) {
  child.on("error", (error) => {
    console.error("Could not start a development service:", error);
    process.exitCode = 1;
    stopServices("SIGTERM");
  });
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code || 1;
      stopServices("SIGTERM");
    }
  });
}
