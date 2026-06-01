import { Link } from "react-router";
import type { Route } from "./+types/sponsor-player-success";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Thank you · Doncaster City FC" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const playerName = url.searchParams.get("player") ?? "the player";
  return { playerName };
}

export default function SponsorPlayerSuccess({ loaderData }: Route.ComponentProps) {
  const { playerName } = loaderData;
  return (
    <>
      <PageHeader
        eyebrow="Sponsorship confirmed"
        title="Thank you."
        lede={`Your sponsorship of ${playerName} is confirmed for the season. You'll receive a receipt by email.`}
      />
      <Container size="wide" className="py-12 text-center">
        <Link
          to="/team"
          className="inline-flex items-center gap-2 bg-navy text-paper px-6 py-3 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
        >
          Back to the squad
        </Link>
      </Container>
    </>
  );
}
