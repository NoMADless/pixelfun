export type AbiName = "vault" | "erc20";

export interface AbiRequirement {
  abi: AbiName;
  kind: "function" | "event";
  name: string;
  inputs: readonly string[];
  outputs?: readonly string[];
  usedBy: string;
}

/**
 * Single source of truth for the ABI surface this app calls. `npm run check:abi`
 * compares it with abi/PixelFunVault.json and abi/ERC20.json, so a final-contract
 * rename or type change is reported before a deploy.
 */
export const ABI_REQUIREMENTS: readonly AbiRequirement[] = [
  // Canvas.
  { abi: "vault", kind: "function", name: "getPixels", inputs: ["uint32", "uint32"], outputs: ["bytes"], usedBy: "canvas reads" },
  { abi: "vault", kind: "event", name: "Painted", inputs: ["address", "uint64", "uint32[]", "uint8[]", "uint256"], usedBy: "live canvas logs" },

  // Stats and rounds.
  { abi: "vault", kind: "function", name: "PRICE", inputs: [], outputs: ["uint256"], usedBy: "paint cost / about" },
  { abi: "vault", kind: "function", name: "totalPixelsPainted", inputs: [], outputs: ["uint256"], usedBy: "stats / burned" },
  { abi: "vault", kind: "function", name: "currentEpoch", inputs: [], outputs: ["uint64"], usedBy: "leaderboard" },
  { abi: "vault", kind: "function", name: "epochStart", inputs: ["uint64"], outputs: ["uint64"], usedBy: "leaderboard" },
  { abi: "vault", kind: "function", name: "epochEnd", inputs: ["uint64"], outputs: ["uint64"], usedBy: "countdown" },
  { abi: "vault", kind: "function", name: "epochEnded", inputs: ["uint64"], outputs: ["bool"], usedBy: "WL finality" },
  { abi: "vault", kind: "function", name: "EPOCH_LENGTH", inputs: [], outputs: ["uint64"], usedBy: "about / rounds" },
  { abi: "vault", kind: "function", name: "MIN_PIXELS", inputs: [], outputs: ["uint256"], usedBy: "rank minimum" },
  { abi: "vault", kind: "function", name: "BOARD_SIZE", inputs: [], outputs: ["uint16"], usedBy: "leaderboard" },
  { abi: "vault", kind: "function", name: "MAX_BATCH", inputs: [], outputs: ["uint16"], usedBy: "paint batching" },
  { abi: "vault", kind: "function", name: "WIDTH", inputs: [], outputs: ["uint16"], usedBy: "smoke check" },
  { abi: "vault", kind: "function", name: "HEIGHT", inputs: [], outputs: ["uint16"], usedBy: "smoke check" },
  { abi: "vault", kind: "function", name: "PALETTE_SIZE", inputs: [], outputs: ["uint8"], usedBy: "palette invariant" },
  { abi: "vault", kind: "function", name: "EPOCH_START", inputs: [], outputs: ["uint64"], usedBy: "smoke check" },

  // Boards and viewer state.
  { abi: "vault", kind: "function", name: "getBoard", inputs: ["uint64"], outputs: ["address[]", "uint32[]"], usedBy: "leaderboard" },
  { abi: "vault", kind: "function", name: "pixelsPaintedIn", inputs: ["uint64", "address"], outputs: ["uint256"], usedBy: "my rank" },
  { abi: "vault", kind: "function", name: "isWhitelisted", inputs: ["uint64", "address"], outputs: ["bool"], usedBy: "WL badge" },
  { abi: "vault", kind: "function", name: "balanceOf", inputs: ["address"], outputs: ["uint256"], usedBy: "vault balance / withdraw" },

  // Writes.
  { abi: "vault", kind: "function", name: "deposit", inputs: ["uint256"], usedBy: "vault deposit" },
  { abi: "vault", kind: "function", name: "withdraw", inputs: ["uint256"], usedBy: "vault withdraw" },
  { abi: "vault", kind: "function", name: "paint", inputs: ["uint32[]", "uint8[]"], usedBy: "paint write" },

  // IMD token.
  { abi: "erc20", kind: "function", name: "decimals", inputs: [], outputs: ["uint8"], usedBy: "price display" },
  { abi: "erc20", kind: "function", name: "balanceOf", inputs: ["address"], outputs: ["uint256"], usedBy: "wallet balance" },
  { abi: "erc20", kind: "function", name: "allowance", inputs: ["address", "address"], outputs: ["uint256"], usedBy: "approve check" },
  { abi: "erc20", kind: "function", name: "approve", inputs: ["address", "uint256"], outputs: ["bool"], usedBy: "deposit approve" },
];
