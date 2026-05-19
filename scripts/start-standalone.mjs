import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const standaloneDir = resolve(root, ".next/standalone");
const standaloneServer = resolve(standaloneDir, "server.js");

function copyIfExists(from, to) {
  if (!existsSync(from)) return;
  cpSync(from, to, { recursive: true, force: true });
}

function run(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });
}

if (existsSync(standaloneServer)) {
  copyIfExists(resolve(root, "public"), resolve(standaloneDir, "public"));
  copyIfExists(resolve(root, ".next/static"), resolve(standaloneDir, ".next/static"));
  run("node", [standaloneServer]);
} else {
  run("next", ["start"]);
}
