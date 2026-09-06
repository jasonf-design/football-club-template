import { club } from "~/club.config";

export function Crest({
  className = "h-10 w-10",
  alt = `${club.name.short} crest`,
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <picture>
      <source srcSet="/crest-128.avif" type="image/avif" />
      <source srcSet="/crest-128.webp" type="image/webp" />
      <img
        src="/crest-128.png"
        alt={alt}
        className={className}
        width={64}
        height={64}
      />
    </picture>
  );
}
