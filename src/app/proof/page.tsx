import type { Metadata } from "next";
import { ProofView } from "@/components/proof/ProofView";

export const metadata: Metadata = {
  title: "Proof",
  description:
    "Public deployment proof for PixelFun: vault address, deploy transaction, published source commit, IMD verification gates and live on-chain paint numbers.",
};

export default function ProofPage() {
  return <ProofView />;
}
