import type { Metadata } from "next";
import { AboutView } from "@/components/about/AboutView";

export const metadata: Metadata = {
  title: "About",
  description:
    "How PixelFun works: 0.005 IMD per pixel sent to the dead address, a vault you control, 3-day rounds and top-66 whitelist spots. The vault has no owner, admin or upgrade path.",
};

export default function AboutPage() {
  return <AboutView />;
}
