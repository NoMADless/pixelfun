export interface ProofConfig {
  /** Deployed PixelFunVault address. Linked to the explorer when present. */
  contractAddress?: string;
  /** Verified contract page (Blockscout /address/0x…?tab=contract). */
  explorerUrl?: string;
  /** IMD launch number, if the token launch platform assigns one. */
  imdLaunchNumber?: string | number;
  /** Public launch/job page for the IMD token. */
  imdJobUrl?: string;
  /** Independent audit report. */
  auditReportUrl?: string;
  /** True when the deployed bytecode matches the audited build. */
  deployedUnchanged?: boolean;
  /** Demo transactions: deposit, paint, board read, etc. */
  demoTxUrls?: readonly string[];
  /** Official X account. */
  xAccountUrl?: string;
  /** Public source repository. */
  repoUrl?: string;
}

/**
 * Fill these after the vault is live and the demo transactions are recorded.
 * Every field is optional: empty entries are hidden on /proof, and leaving all
 * of them empty shows the neutral “launch details coming soon” state.
 */
export const PROOF: ProofConfig = {
  demoTxUrls: [],
};
