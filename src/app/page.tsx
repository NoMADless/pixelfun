import { CanvasStudio } from "@/components/canvas/CanvasStudio";
import { SITE_URL } from "@/config/site";

export default function HomePage() {
  // Pass the server-resolved origin so SSR and hydration render the same share href.
  return <CanvasStudio siteUrl={SITE_URL} />;
}
