import { Link } from "react-router";

export function ResultCard({
  id,
  slug,
  opponent,
  homeAway,
  homeScore,
  awayScore,
  competition,
  date,
  youtubeUrl,
}: {
  id?: string;
  slug?: string | null;
  opponent: string;
  homeAway: "home" | "away";
  homeScore: number | null;
  awayScore: number | null;
  competition: string;
  date: Date;
  youtubeUrl?: string | null;
}) {
  const us = homeAway === "home" ? homeScore : awayScore;
  const them = homeAway === "home" ? awayScore : homeScore;
  const outcome =
    us == null || them == null
      ? null
      : us > them
        ? "W"
        : us < them
          ? "L"
          : "D";

  const outcomeColor = {
    W: "bg-green text-paper",
    D: "bg-mute text-paper",
    L: "bg-red text-paper",
  };

  const inner = (
    <>
      <div className="text-[10px] uppercase tracking-[0.22em] text-mute">
        {competition} ·{" "}
        {date.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
        })}
      </div>
      {youtubeUrl && (
        <div className="mt-1 mb-0.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] font-semibold bg-[#FF0000] text-white">
            ▶ Video
          </span>
        </div>
      )}
      <div className="mt-1.5 flex items-baseline gap-4">
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-mute">
            {homeAway === "home" ? "vs" : "at"}
          </div>
          <div className="text-lg font-medium text-ink truncate">
            {opponent}
          </div>
        </div>
        <div className="scoreboard text-4xl text-navy leading-none flex items-baseline gap-1.5">
          <span>{us ?? "–"}</span>
          <span className="text-mute/40">·</span>
          <span>{them ?? "–"}</span>
        </div>
        {outcome && (
          <div
            className={[
              "inline-flex items-center justify-center h-7 w-7 text-xs font-bold tracking-wider",
              outcomeColor[outcome as "W" | "D" | "L"],
            ].join(" ")}
          >
            {outcome}
          </div>
        )}
      </div>
    </>
  );

  const baseCls =
    "flex flex-col bg-paper border-l-2 border-navy pl-5 py-1";
  if (id) {
    return (
      <Link
        to={`/fixtures/${slug ?? id}`}
        className={`${baseCls} hover:bg-paper-warm/60 transition-colors`}
      >
        {inner}
      </Link>
    );
  }
  return <article className={baseCls}>{inner}</article>;
}
