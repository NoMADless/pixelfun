import { SITE_URL } from "@/config/site";

export function shareOnXUrl(text: string, url = SITE_URL): string {
  const params = new URLSearchParams({ text, url });
  return `https://x.com/intent/post?${params.toString()}`;
}

export const SHARE_TEXT =
  "I'm painting on PixelFun — a 512×512 fully on-chain canvas on Robinhood Chain. No owner, no admin, no upgrades.";
