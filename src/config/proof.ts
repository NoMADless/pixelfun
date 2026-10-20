/** One demo transaction: a human label and its explorer link. */
export interface DemoTx {
  label: string;
  url: string;
}

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
  /** Demo transactions: deposit, paint, withdraw, etc. Shown in array order. */
  demoTxUrls?: readonly DemoTx[];
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
  imdJobUrl: "https://explorer.imd.fun/jobs/7080a75d-d9a3-48da-a85c-9cb4e20a6f67",
  repoUrl: "https://github.com/identity-md-launches/launch-2148-dsa",
  deployedUnchanged: true,
  demoTxUrls: [
    {
      label: "Deposit 0.05 IMD",
      url: "https://robin.etherscan.io/tx/0x400b4ab429e47ca69faa8770ec6b8c043e838445a5adab2f362bbeb11e4d23c3",
    },
    {
      label: "Paint 1 px (0.005 IMD to the dead address)",
      url: "https://robin.etherscan.io/tx/0x1acce07cd2e11467b52b160dd72c091d97ff9f881c83aaf9e38e69f78990fb0f",
    },
    {
      label: "Paint 3 px (0.015 IMD)",
      url: "https://robin.etherscan.io/tx/0xc6b32e9679088aa11ec5aea44a28fed0c00878b096018e73ee2e6c6e512cace6",
    },
    {
      label: "Withdraw 0.03 IMD",
      url: "https://robin.etherscan.io/tx/0x6c005fca5fbc562d762953a868ced027459d42489c6f6e51a3dc7295c11ab96b",
    },
    {
      label: "Deposit 0.1221 IMD",
      url: "https://robin.etherscan.io/tx/0x7600d5cc69dee6f3449bd8b6341ef63d4445eacfccaf45a7d264a2da1d555828",
    },
    {
      label: "Paint 16 px (0.08 IMD)",
      url: "https://robin.etherscan.io/tx/0x147c9563facad1d647dc725facf965ff157fde1cd49ccc877ee58655bef3e778",
    },
    {
      label: "Withdraw 0.0421 IMD",
      url: "https://robin.etherscan.io/tx/0x2a31d00ac882e341e2807423e923e7d04697fd6155679ca10c51cb016e1014dc",
    },
  ],
};
