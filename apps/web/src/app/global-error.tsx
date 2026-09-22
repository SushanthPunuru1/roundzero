"use client";

/**
 * The last line of defence: an error thrown by the ROOT layout itself, which
 * every other boundary sits inside and therefore cannot catch. Next replaces
 * the whole document with this, so it has to supply its own <html> and
 * <body>.
 *
 * ---------------------------------------------------------------------------
 * Why this file breaks golden rule 3 (compose UI from packages/ui only) and
 * DESIGN.md's "no raw colours" on purpose:
 *
 * If the root layout failed, the most likely single cause is that its one
 * side-effect import — `./globals.css` — did not load. Every token, every
 * Tailwind utility, and every component in `packages/ui` is downstream of
 * that stylesheet. A boundary built from them would render as unstyled black
 * text on white in exactly the case it exists to handle.
 *
 * So this screen is deliberately self-contained: inline styles, literal hex
 * values, no imports at all. The values are copied from `globals.css` and
 * will not track changes to it — which is acceptable for one screen almost
 * nobody will ever see, and is the whole point for the few who do.
 * ---------------------------------------------------------------------------
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          // --bg / --text / --font-body, literal. See the note above.
          background: "#0b0d11",
          color: "#e8eaf0",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <div style={{ maxWidth: "420px", textAlign: "center" }}>
          <p
            style={{
              margin: 0,
              fontFamily:
                'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
              fontSize: "11px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#98a1ae",
            }}
          >
            RoundZero
          </p>
          <h1
            style={{
              margin: "12px 0 0",
              fontSize: "25px",
              lineHeight: "32px",
              fontWeight: 600,
            }}
          >
            RoundZero failed to start
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "14px",
              lineHeight: "22px",
              color: "#98a1ae",
            }}
          >
            This is a fault on our side, not a problem with your account or
            your progress. Reloading usually clears it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "24px",
              height: "36px",
              padding: "0 16px",
              border: "none",
              borderRadius: "6px",
              background: "#e8a33d",
              color: "#0b0d11",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p
              style={{
                margin: "20px 0 0",
                fontFamily:
                  'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
                fontSize: "11px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "#98a1ae",
              }}
            >
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
