export function Crest({
  className = "h-10 w-10",
  alt = "Doncaster City FC crest",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    <img
      src="/DoncasterCity.png"
      alt={alt}
      className={className}
      width={64}
      height={64}
    />
  );
}
