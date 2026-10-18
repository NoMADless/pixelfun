import type { Metadata } from "next";
import { ProofView } from "@/components/proof/ProofView";

export const metadata: Metadata = {
  title: "Proof",
  description:
    "Public launch proof for PixelFun: vault address, verified source, audit and demo transactions, plus live on-chain paint and burn numbers.",
};

export default function ProofPage() {
  return <ProofView />;
}
