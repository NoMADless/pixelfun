import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ABI_REQUIREMENTS,
  type AbiName,
  type AbiRequirement,
} from "../src/lib/abi-requirements";

interface AbiItem {
  type?: string;
  name?: string;
  inputs?: Array<{ type: string }>;
  outputs?: Array<{ type: string }>;
}

const FILES: Record<AbiName, string> = {
  vault: "abi/PixelFunVault.json",
  erc20: "abi/ERC20.json",
};

function itemSignature(item: AbiItem): string {
  const inputs = (item.inputs ?? []).map((input) => input.type).join(",");
  const base = `${item.name ?? "?"}(${inputs})`;
  if (item.type === "function" && item.outputs && item.outputs.length > 0) {
    return `${base} -> ${item.outputs.map((output) => output.type).join(",")}`;
  }
  return base;
}

function requiredSignature(requirement: AbiRequirement): string {
  const base = `${requirement.name}(${requirement.inputs.join(",")})`;
  return requirement.outputs && requirement.outputs.length > 0
    ? `${base} -> ${requirement.outputs.join(",")}`
    : base;
}

function sameTypes(actual: Array<{ type: string }> | undefined, expected: readonly string[]): boolean {
  const types = (actual ?? []).map((item) => item.type);
  return types.length === expected.length && types.every((type, index) => type === expected[index]);
}

const root = process.cwd();
const abis: Record<AbiName, AbiItem[]> = {
  vault: JSON.parse(readFileSync(join(root, FILES.vault), "utf8")) as AbiItem[],
  erc20: JSON.parse(readFileSync(join(root, FILES.erc20), "utf8")) as AbiItem[],
};

let failures = 0;
for (const abiName of ["vault", "erc20"] as const) {
  const requirements = ABI_REQUIREMENTS.filter((requirement) => requirement.abi === abiName);
  if (requirements.length === 0) continue;
  console.log(`\n${FILES[abiName]}`);

  for (const requirement of requirements) {
    const candidates = abis[abiName].filter(
      (item) => item.type === requirement.kind && item.name === requirement.name,
    );
    const expected = requiredSignature(requirement);

    if (candidates.length === 0) {
      failures++;
      console.log(`  FAIL missing ${requirement.kind} ${expected} (${requirement.usedBy})`);
      continue;
    }

    const match = candidates.find(
      (item) =>
        sameTypes(item.inputs, requirement.inputs) &&
        (requirement.kind === "event" || sameTypes(item.outputs, requirement.outputs ?? [])),
    );
    if (match) {
      console.log(`  PASS ${requirement.kind} ${expected}`);
    } else {
      failures++;
      console.log(`  FAIL different ${requirement.kind} ${expected} (${requirement.usedBy})`);
      for (const candidate of candidates) {
        console.log(`       found ${candidate.type} ${itemSignature(candidate)}`);
      }
    }
  }
}

if (failures > 0) {
  console.error(`\nABI check failed: ${failures} required entry/entries missing or different.`);
  process.exitCode = 1;
} else {
  console.log(`\nABI check passed: ${ABI_REQUIREMENTS.length} required entries match.`);
}
