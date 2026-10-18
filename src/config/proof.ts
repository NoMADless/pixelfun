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
  imdLaunchNumber: 2148,
  repoUrl: "https://github.com/identity-md-launches/launch-2148-dsa",

  // TODO: set to true only after comparing the deployed runtime bytecode with
  // the audited build. Until then /proof says "not yet confirmed".
  deployedUnchanged: false,

  // TODO: fill after IMD deploys and the explorer verifies the source.
  contractAddress: undefined,
  explorerUrl: undefined,
  auditReportUrl: undefined,
  xAccountUrl: undefined,
  imdJobUrl: undefined,

  // TODO: add one deposit, one paint and one board-read transaction after launch.
  demoTxUrls: [],
};
