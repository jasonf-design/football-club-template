import { Link } from "react-router";

export function NewsCard({
  slug,
  title,
  excerpt,
  date,
  category,
  hero,
  size = "default",
}: {
  slug: string;
  title: string;
  excerpt?: string | null;
  date: Date;
  category?: string;
  hero?: string | null;
  size?: "default" | "feature";
}) {
  const isFeature = size === "feature";
  return (
    <Link
      to={`/news/${slug}`}
      className="group block h-full"
    >
      <article className="h-full flex flex-col">
        <div
          className={[
            "relative overflow-hidden bg-navy/5",
            isFeature ? "aspect-[16/10]" : "aspect-[4/3]",
          ].join(" ")}
        >
          {hero ? (
            <img
              src={hero}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-deep to-sky/20" />
          )}
          {category && (
            <div className="absolute top-4 left-4 bg-paper text-navy text-[10px] tracking-[0.2em] uppercase px-2.5 py-1">
              {category}
            </div>
          )}
        </div>
        <div className="pt-5 flex-1 flex flex-col">
          <time className="text-[11px] uppercase tracking-[0.18em] text-mute">
            {date.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </time>
          <h3
            className={[
              "font-serif text-navy mt-2 group-hover:text-sky-bright transition-colors leading-tight text-balance",
              isFeature ? "text-3xl md:text-4xl" : "text-xl",
            ].join(" ")}
          >
            {title}
          </h3>
          {excerpt && (
            <p
              className={[
                "text-mute mt-3 leading-relaxed",
                isFeature ? "text-base" : "text-sm",
              ].join(" ")}
            >
              {excerpt}
            </p>
          )}
          <span className="mt-4 inline-flex items-center text-xs tracking-wide uppercase text-navy font-medium">
            Read story
            <svg
              className="ml-1.5 h-3 w-3 transition-transform group-hover:translate-x-1"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M1 6h10M7 2l4 4-4 4" />
            </svg>
          </span>
        </div>
      </article>
    </Link>
  );
}
