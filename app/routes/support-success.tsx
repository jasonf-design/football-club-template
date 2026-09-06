import { Link, useSearchParams } from "react-router";
import type { Route } from "./+types/support-success";
import { Container } from "~/components/Container";
import { club } from "~/club.config";

export function meta(_: Route.MetaArgs) {
  return [{ title: `Thank you · ${club.name.short}` }];
}

export default function SupportSuccess() {
  const [params] = useSearchParams();
  const amount = params.get("amount");

  return (
    <Container size="default" className="py-24 text-center">
      <div className="max-w-md mx-auto">
        <div className="text-5xl mb-6">💙</div>
        <h1 className="font-serif text-4xl text-navy mb-4">Thank you!</h1>
        <p className="text-mute text-lg leading-relaxed mb-2">
          {amount ? (
            <>Your £{amount} contribution means the world to us.</>
          ) : (
            <>Your contribution means the world to us.</>
          )}
        </p>
        <p className="text-mute leading-relaxed mb-10">
          Every pound goes directly towards kit, equipment, and growing Doncaster City FC. You're part of the story.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/team"
            className="inline-flex items-center justify-center gap-2 bg-navy text-paper px-6 py-3 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
          >
            Meet the squad
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 border border-line px-6 py-3 text-sm font-semibold tracking-wide uppercase hover:border-navy hover:text-navy transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    </Container>
  );
}
