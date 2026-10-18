import type { Metadata } from "next";
import { AboutView } from "@/components/about/AboutView";

export const metadata: Metadata = {
  title: "About",
  description:
    "How PixelFun works: 0.005 IMD per pixel, burned on-chain, a vault you control, 3-day rounds and top-66 whitelist spots. No owner, no admin, no upgrades.",
};

export default function AboutPage() {
  return <AboutView />;
}
