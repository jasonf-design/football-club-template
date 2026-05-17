import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico", sizes: "any" },
  { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0E1F44" />
        <Meta />
        <Links />
      </head>
      <body className="bg-paper text-ink font-sans antialiased">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;
  let status: number | undefined;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    message = error.status === 404 ? "Off the pitch" : "Error";
    details =
      error.status === 404
        ? "The page you were looking for has wandered offside."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-24">
      <div className="max-w-xl text-center">
        {status && (
          <div className="font-display text-[10rem] leading-none text-navy/10 select-none">
            {status}
          </div>
        )}
        <h1 className="font-serif text-4xl text-navy mt-2">{message}</h1>
        <p className="mt-4 text-mute">{details}</p>
        <a
          href="/"
          className="inline-block mt-8 px-5 py-2.5 bg-navy text-paper text-sm font-medium tracking-wide uppercase hover:bg-navy-deep transition-colors"
        >
          Back to homepage
        </a>
        {stack && (
          <pre className="w-full mt-8 p-4 text-left text-xs bg-navy/5 overflow-x-auto rounded">
            <code>{stack}</code>
          </pre>
        )}
      </div>
    </main>
  );
}
