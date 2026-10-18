"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PROOF } from "@/config/proof";
import {
  CONTRACTS_CONFIGURED,
  explorerAddressUrl,
  explorerTxUrl,
} from "@/config/chains";
import { useStats } from "@/lib/hooks/useLeaderboard";
import { formatCount, formatToken } from "@/lib/format";
import { useRuntimeConfig } from "@/lib/runtime";
import { TOKEN_SYMBOL } from "@/shared/palette";

const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="break-all underline underline-offset-2 hover:text-accent"
    >
      {children}
    </a>
  );
}

function ProofRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-t-2 border-line py-2 first:border-t-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="text-[9px] font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="min-w-0 text-[11px]">{children}</dd>
    </div>
  );
}

export function ProofView() {
  const { mockMode } = useRuntimeConfig();
  const enabled = mockMode || CONTRACTS_CONFIGURED;
  const statsQuery = useStats(enabled);
  const stats = statsQuery.data;

  const hasDetails = Boolean(
    PROOF.contractAddress ||
      PROOF.explorerUrl ||
      PROOF.deployTxHash ||
      PROOF.imdLaunchNumber !== undefined ||
      PROOF.imdJobUrl ||
      PROOF.auditReportUrl ||
      typeof PROOF.deployedUnchanged === "boolean" ||
      (PROOF.demoTxUrls && PROOF.demoTxUrls.length > 0) ||
      PROOF.xAccountUrl ||
      PROOF.repoUrl,
  );

  const contractHref = PROOF.contractAddress
    ? PROOF.explorerUrl || explorerAddressUrl(PROOF.contractAddress)
    : PROOF.explorerUrl;
  const deployHref = PROOF.deployTxHash ? explorerTxUrl(PROOF.deployTxHash) : undefined;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-3 py-4 sm:py-6">
      <header className="pixel-panel-strong p-4 sm:p-6">
        <p className="text-[8px] font-bold uppercase tracking-wider text-muted">PX / PROOF</p>
        <h1 className="pixel-font mt-2 text-lg leading-relaxed sm:text-2xl">PROOF, NOT PROMISES.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          The canvas, vault and payments live on Robinhood Chain. This page collects the public
          proof: contract address, deploy transaction, published source commit, compiler settings
          and demo transactions.
        </p>
      </header>

      {!hasDetails ? (
        <section className="mt-4 border-2 border-line bg-panel p-6 text-center" aria-live="polite">
          <p className="pixel-font text-[11px] text-muted">LAUNCH DETAILS COMING SOON</p>
          <p className="mx-auto mt-3 max-w-md text-[11px] leading-relaxed text-muted">
            The contract address, verified source, audit and demo transaction links will appear
            here once they are published. Until then, nothing on this page is fabricated.
          </p>
        </section>
      ) : (
        <section className="mt-4 pixel-panel p-4">
          <h2 className="pixel-font text-[11px]">LAUNCH DETAILS</h2>
          <dl className="mt-2">
            {PROOF.contractAddress ? (
              <ProofRow label="Vault contract">
                {contractHref ? (
                  <ExternalLink href={contractHref}>
                    <span className="font-mono">{PROOF.contractAddress}</span>
                  </ExternalLink>
                ) : (
                  <span className="font-mono">{PROOF.contractAddress}</span>
                )}
              </ProofRow>
            ) : null}
            {PROOF.deployTxHash ? (
              <ProofRow label="Deploy tx">
                <span className="flex flex-col gap-1">
                  {deployHref ? (
                    <ExternalLink href={deployHref}>
                      <span className="font-mono">{PROOF.deployTxHash}</span>
                    </ExternalLink>
                  ) : (
                    <span className="font-mono">{PROOF.deployTxHash}</span>
                  )}
                  {PROOF.deployBlock !== undefined ? (
                    <span className="text-muted">block {PROOF.deployBlock.toLocaleString()}</span>
                  ) : null}
                </span>
              </ProofRow>
            ) : null}
            {PROOF.explorerUrl ? (
              <ProofRow label="Contract page">
                <ExternalLink href={PROOF.explorerUrl}>Open on the explorer ↗</ExternalLink>
              </ProofRow>
            ) : null}
            {PROOF.sourceCommitUrl && PROOF.sourceCommit ? (
              <ProofRow label="Source commit">
                <ExternalLink href={PROOF.sourceCommitUrl}>
                  <span className="font-mono">{PROOF.sourceCommit}</span> ↗
                </ExternalLink>
              </ProofRow>
            ) : null}
            {PROOF.constructorArgs ? (
              <ProofRow label="Constructor args">
                <span className="font-mono">{PROOF.constructorArgs}</span>
              </ProofRow>
            ) : null}
            {PROOF.compiler ? (
              <ProofRow label="Compiler">
                <span className="font-mono">{PROOF.compiler}</span>
              </ProofRow>
            ) : null}
            {typeof PROOF.deployedUnchanged === "boolean" ? (
              <ProofRow label="Bytecode">
                {PROOF.deployedUnchanged ? (
                  <span className="text-pfgreen">
                    Runtime and creation code match the published build
                  </span>
                ) : (
                  <span className="text-muted">
                    Not yet confirmed — the deployed bytecode has not been matched to the published
                    build.
                  </span>
                )}
              </ProofRow>
            ) : null}
            {PROOF.verificationGates && PROOF.verificationGates.length > 0 ? (
              <ProofRow label="IMD verification">
                <span className="flex flex-col gap-1.5">
                  <span>
                    {PROOF.verificationGates.length} gates passed
                    {PROOF.verificationTool ? ` (${PROOF.verificationTool})` : ""}
                  </span>
                  <span className="flex flex-wrap gap-1">
                    {PROOF.verificationGates.map((gate) => (
                      <span
                        key={gate}
                        className="border-2 border-line bg-bg px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-muted"
                      >
                        {gate}
                      </span>
                    ))}
                  </span>
                </span>
              </ProofRow>
            ) : null}
            {PROOF.attestation ? (
              <ProofRow label="Attestation">
                <span className="font-mono text-[9px]">{PROOF.attestation}</span>
              </ProofRow>
            ) : null}
            {PROOF.manifest ? (
              <ProofRow label="Manifest">
                <span className="font-mono text-[9px]">{PROOF.manifest}</span>
              </ProofRow>
            ) : null}
            {PROOF.imdLaunchNumber !== undefined ? (
              <ProofRow label="IMD launch">
                <span className="font-mono">#{PROOF.imdLaunchNumber}</span>
              </ProofRow>
            ) : null}
            {PROOF.imdJobUrl ? (
              <ProofRow label="Launch page">
                <ExternalLink href={PROOF.imdJobUrl}>IMD launch details ↗</ExternalLink>
              </ProofRow>
            ) : null}
            {PROOF.auditReportUrl ? (
              <ProofRow label="Audit">
                <ExternalLink href={PROOF.auditReportUrl}>Read the audit report ↗</ExternalLink>
              </ProofRow>
            ) : null}
            {PROOF.xAccountUrl ? (
              <ProofRow label="X">
                <ExternalLink href={PROOF.xAccountUrl}>Official account ↗</ExternalLink>
              </ProofRow>
            ) : null}
            {PROOF.repoUrl ? (
              <ProofRow label="Source">
                <ExternalLink href={PROOF.repoUrl}>Public repository ↗</ExternalLink>
              </ProofRow>
            ) : null}
            {PROOF.demoTxUrls && PROOF.demoTxUrls.length > 0 ? (
              <ProofRow label="Demo transactions">
                <span className="flex flex-col gap-1">
                  {PROOF.demoTxUrls.map((url, index) => (
                    <ExternalLink key={url} href={url}>
                      Demo tx {index + 1} ↗
                    </ExternalLink>
                  ))}
                </span>
              </ProofRow>
            ) : null}
          </dl>
          <p className="mt-3 border-t-2 border-line pt-2 text-[8px] leading-relaxed text-muted">
            The IMD verification gates are checks performed by the token launcher&apos;s own
            verifier. They are not a third-party audit. The bytecode line is confirmed by
            comparing the deployed runtime and creation code with the published build.
          </p>
        </section>
      )}

      <section className="mt-4 pixel-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="pixel-font text-[11px]">LIVE ON-CHAIN NUMBERS</h2>
          {stats ? (
            <span
              className={`border px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                stats.mock
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-pfgreen bg-pfgreen/10 text-pfgreen"
              }`}
            >
              {stats.mock ? "Demo data" : "Live chain data"}
            </span>
          ) : null}
        </div>

        {!enabled ? (
          <p className="mt-3 border-2 border-line bg-bg p-3 text-[10px] text-muted">
            Live numbers appear once the vault is configured. Set{" "}
            <code className="font-mono">NEXT_PUBLIC_VAULT_ADDRESS</code> and{" "}
            <code className="font-mono">NEXT_PUBLIC_IMD_ADDRESS</code>, or run with{" "}
            <code className="font-mono">MOCK_MODE=true</code>.
          </p>
        ) : statsQuery.isError ? (
          <div className="mt-3 border-2 border-accent bg-accent/10 p-3 text-[10px]">
            <p className="font-bold text-accent">Could not read the vault.</p>
            <p className="mt-1 break-words text-muted">
              {statsQuery.error instanceof Error ? statsQuery.error.message : "Unknown RPC error."}
            </p>
            <button
              type="button"
              onClick={() => void statsQuery.refetch()}
              className="pixel-btn mt-2 h-7 px-2 text-[9px]"
            >
              Retry
            </button>
          </div>
        ) : !stats ? (
          <div className="mt-3 space-y-2" aria-label="Loading on-chain numbers">
            <div className="h-5 w-56 animate-pulse bg-panel2" />
            <div className="h-5 w-44 animate-pulse bg-panel2" />
            <div className="h-5 w-36 animate-pulse bg-panel2" />
          </div>
        ) : (
          <dl className="mt-3 grid gap-2 sm:grid-cols-3">
            <div className="border-2 border-line bg-bg p-2.5">
              <dt className="text-[8px] font-bold uppercase tracking-wider text-muted">
                Total painted
              </dt>
              <dd className="pixel-font mt-1 text-[12px]">
                {formatCount(BigInt(stats.totalPixelsPainted))} px
              </dd>
            </div>
            <div className="border-2 border-line bg-bg p-2.5">
              <dt className="text-[8px] font-bold uppercase tracking-wider text-muted">
                IMD to the dead address
              </dt>
              <dd className="pixel-font mt-1 text-[12px] text-accent">
                {formatToken(BigInt(stats.burned), stats.decimals, 4)} {TOKEN_SYMBOL}
              </dd>
            </div>
            <div className="border-2 border-line bg-bg p-2.5">
              <dt className="text-[8px] font-bold uppercase tracking-wider text-muted">
                Current round
              </dt>
              <dd className="pixel-font mt-1 text-[12px]">#{stats.currentEpoch}</dd>
            </div>
          </dl>
        )}
        <p className="mt-2 text-[8px] leading-relaxed text-muted">
          Values are public contract reads served by <code className="font-mono">/api/stats</code>.{" "}
          The IMD figure is <code className="font-mono">totalBurned()</code>: IMD transferred by
          painting to{" "}
          <ExternalLink href={explorerAddressUrl(DEAD_ADDRESS)}>{DEAD_ADDRESS}</ExternalLink>. It is
          a transfer, not a supply burn; IMD <code className="font-mono">totalSupply</code> is not
          reduced by painting.
          {stats?.mock ? " Mock mode is showing synthetic demo values, not launch proof." : ""}
        </p>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/" className="pixel-btn pixel-btn-primary h-9 px-3 text-[10px]">
          Open the canvas
        </Link>
        <Link href="/about" className="pixel-btn h-9 px-3 text-[10px]">
          How it works
        </Link>
        <Link href="/leaderboard" className="pixel-btn h-9 px-3 text-[10px]">
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
