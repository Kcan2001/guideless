"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { emails } from "@guideless/config";

/** Last-resort error boundary (root layout failures). Human message; technical detail → Sentry. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "Inter, system-ui, sans-serif",
          background: "#F5F6F2",
          color: "#0B2025",
        }}
      >
        <main style={{ maxWidth: 560, margin: "0 auto", padding: "96px 24px" }}>
          <p
            style={{
              fontSize: 12,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "#586266",
            }}
          >
            Something went wrong
          </p>
          <h1 style={{ fontSize: 32, lineHeight: 1.1, margin: "12px 0" }}>
            We hit a snag on our side.
          </h1>
          <p style={{ color: "#586266" }}>
            Nothing was charged and your booking is safe. Try again, or email{" "}
            <a href={`mailto:${emails.support}`} style={{ color: "#17B1DF" }}>
              {emails.support}
            </a>
            {error.digest ? ` and mention reference ${error.digest}.` : "."}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#0B2025",
              color: "#fff",
              border: 0,
              borderRadius: 10,
              padding: "12px 20px",
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
