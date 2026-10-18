import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { createPublicClient, http } from "viem";
import { anvil } from "viem/chains";
import { CONFIG } from "./config";

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a local port."));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

export interface AnvilHandle {
  url: string;
  port: number;
  stop: () => Promise<void>;
}

export interface AnvilOptions {
  /** Fork this RPC's state. Omit for a clean local chain. */
  forkUrl?: string;
  /** Defaults to CONFIG.chainId (31337). */
  chainId?: number;
  /** Defaults to CONFIG.walletCount. */
  accounts?: number;
}

export async function startAnvil(options: AnvilOptions = {}): Promise<AnvilHandle> {
  const port = CONFIG.anvilPort > 0 ? CONFIG.anvilPort : await freePort();
  const chainId = options.chainId ?? CONFIG.chainId;
  const args = [
    "--port",
    String(port),
    "--chain-id",
    String(chainId),
    "--accounts",
    String(options.accounts ?? CONFIG.walletCount),
    "--balance",
    "1000000",
    "--mnemonic",
    CONFIG.mnemonic,
    "--silent",
  ];
  if (options.forkUrl) args.push("--fork-url", options.forkUrl);

  const child: ChildProcess = spawn(CONFIG.anvilBin, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  const output: string[] = [];
  child.stdout?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => output.push(chunk.toString()));
  const state: { exited: { code: number | null; signal: NodeJS.Signals | null } | null } = {
    exited: null,
  };
  child.on("exit", (code, signal) => {
    state.exited = { code, signal };
  });

  const url = `http://127.0.0.1:${port}`;
  const chain = chainId === anvil.id ? anvil : { ...anvil, id: chainId };
  const client = createPublicClient({ chain, transport: http(url) });
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (state.exited) {
      throw new Error(
        `anvil exited during startup (code ${state.exited.code}). Is Foundry installed? Output:\n${output.join("")}`,
      );
    }
    try {
      const actualChainId = await client.getChainId();
      if (actualChainId === chainId) {
        console.log(
          `anvil listening on ${url} (chain ${actualChainId}${options.forkUrl ? `, forked from ${options.forkUrl}` : ""})`,
        );
        return {
          url,
          port,
          stop: async () => {
            if (state.exited) return;
            child.kill();
            const stopDeadline = Date.now() + 5_000;
            while (!state.exited && Date.now() < stopDeadline) await delay(50);
            if (!state.exited) child.kill("SIGKILL");
          },
        };
      }
    } catch {
      // not ready yet
    }
    await delay(150);
  }

  child.kill();
  throw new Error(
    `anvil did not answer on ${url} within 20s. Is it installed (Foundry)? Output:\n${output.join("")}`,
  );
}
