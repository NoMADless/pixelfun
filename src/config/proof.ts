export interface ProofConfig {
  /** Deployed PixelFunVault address. Linked to the explorer when present. */
  contractAddress?: string;
  /** Contract page on the chain explorer. */
  explorerUrl?: string;
  /** Deploy transaction hash. */
  deployTxHash?: string;
  /** Block the deploy transaction was included in. */
  deployBlock?: number;
  /** Short source commit hash that the deployed build was compiled from. */
  sourceCommit?: string;
  /** Link to that commit in the public contract repository. */
  sourceCommitUrl?: string;
  /** Constructor arguments as humans read them. */
  constructorArgs?: string;
  /** Compiler and optimizer settings from the build artifact. */
  compiler?: string;
  /** IMD verifier attestation hash. */
  attestation?: string;
  /** IMD launch manifest hash. */
  manifest?: string;
  /** Verifier name and version quoted by the launch receipt. */
  verificationTool?: string;
  /** Named gates the IMD verifier reports as passed. */
  verificationGates?: readonly string[];
  /** IMD launch number, if the token launch platform assigns one. */
  imdLaunchNumber?: string | number;
  /** Public launch/job page for the IMD token. */
  imdJobUrl?: string;
  /** Third-party audit report. Deliberately unset: IMD's verifier is not an audit. */
  auditReportUrl?: string;
  /** True when runtime bytecode and creation code match the published build. */
  deployedUnchanged?: boolean;
  /** Demo transactions: deposit, paint, board read, etc. */
  demoTxUrls?: readonly string[];
  /** Official X account. */
  xAccountUrl?: string;
  /** Public source repository. */
  repoUrl?: string;
}

const SOURCE_COMMIT = "e880bd5931c48ca32e7de751471a4506bd25e6e4";

/**
 * Live Robinhood Chain deployment (launch 2148).
 *
 * `deployedUnchanged` is true because `npm run check:bytecode` compared the
 * on-chain runtime with the artifact from this commit (immutables masked) and
 * found the creation code inside the deploy calldata. The IMD gates are the
 * token launcher's own verification, not a third-party audit.
 */
export const PROOF: ProofConfig = {
  contractAddress: "0x30da521f63553ec3ea2dbb82c30581c00ccf9009",
  explorerUrl:
    "https://robin.etherscan.io/address/0x30da521f63553ec3ea2dbb82c30581c00ccf9009#code",
  deployTxHash: "0xd7c0e30bc98b22a71eff1aa35df2362f131a295cbc981c764c74fc0511b72523",
  deployBlock: 91565987,
  sourceCommit: "e880bd5",
  sourceCommitUrl: `https://github.com/identity-md-launches/launch-2148-dsa/commit/${SOURCE_COMMIT}`,
  constructorArgs: "imd = 0x5F7Bb59365ce557C26dbcAa4EE9d39A4b95B7127, minPixels = 20",
  compiler: "solc 0.8.26+commit.8a97fa7a, optimizer 200",
  attestation: "d218fc6c9de8b8b7869ef0664326793fd76a6adbe8a5f6beaa301da5e704ce18",
  manifest: "2ec05740701b17eb821f5a30977efbeefc7b9acd8270981b98284ad677c416a7",
  verificationTool: "IMD verifier 0.1.0",
  verificationGates: [
    "Provenance",
    "Findings",
    "Independent review",
    "Bytecode",
    "Manifest",
    "Protected invariants",
    "Economics",
  ],
  imdLaunchNumber: 2148,
  repoUrl: "https://github.com/identity-md-launches/launch-2148-dsa",
  deployedUnchanged: true,
  demoTxUrls: [],
};
