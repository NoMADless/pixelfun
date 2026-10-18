import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Abi, Hex } from "viem";
import { ARTIFACTS, CONFIG } from "./config";

export interface Artifact {
  abi: Abi;
  bytecode: Hex;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readArtifact(relativePath: string, label: string): Artifact {
  const path = join(CONFIG.contractRepo, relativePath);
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${label} artifact at ${path}.\n` +
        `Run "forge build" in ${CONFIG.contractRepo} first, or set PIXELFUN_CONTRACT_REPO.`,
    );
  }
  const json = JSON.parse(readFileSync(path, "utf8")) as {
    abi?: unknown;
    bytecode?: { object?: unknown } | string;
    deployedBytecode?: { object?: unknown };
  };
  const abi = json.abi as Abi | undefined;
  const bytecode =
    typeof json.bytecode === "string"
      ? json.bytecode
      : optionalString(json.bytecode?.object);
  if (!Array.isArray(abi) || abi.length === 0) {
    throw new Error(`${label} artifact has no ABI: ${path}`);
  }
  const code = bytecode && /^0x[0-9a-fA-F]+$/.test(bytecode) ? (bytecode as Hex) : null;
  if (!code || code.length < 100) {
    throw new Error(`${label} artifact has no bytecode: ${path}`);
  }
  return { abi, bytecode: code };
}

export function loadVaultArtifact(): Artifact {
  return readArtifact(ARTIFACTS.vault, "PixelFun");
}

export function loadArtifacts(): { vault: Artifact; token: Artifact } {
  return {
    vault: loadVaultArtifact(),
    token: readArtifact(ARTIFACTS.token, "CanvasToken (mock IMD)"),
  };
}
