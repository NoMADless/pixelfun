import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-10">
      <div className="pixel-panel-strong p-5 sm:p-8">
        <p className="pixel-font text-[10px] text-accent">PX / 404</p>
        <h1 className="pixel-font mt-3 text-lg leading-relaxed sm:text-2xl">
          PIXEL NOT
          <br />
          FOUND
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted">
          That route is outside the 512×512 canvas. Head back to the art or check the round board.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/" className="pixel-btn pixel-btn-primary h-9 px-3 text-[10px]">
            Open the canvas
          </Link>
          <Link href="/leaderboard" className="pixel-btn h-9 px-3 text-[10px]">
            Leaderboard
          </Link>
        </div>
      </div>
    </div>
  );
}
