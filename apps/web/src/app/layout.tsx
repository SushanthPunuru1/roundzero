import type { Metadata } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/**
 * The two typefaces `DESIGN.md` specifies. Until now `globals.css` carried a
 * TODO and fell back to `ui-sans-serif` / `ui-monospace`, which meant every
 * screen critiqued so far — including the landing page — was being judged on
 * a system stack rather than the design.
 *
 * Both are self-hosted and free, per golden rule 4. Switzer ships as a file
 * in this repo because Fontshare has no npm package; IBM Plex Mono needs no
 * file at all, because `next/font/google` downloads it at build time and
 * serves it from our own origin. Neither makes a request to a third party at
 * runtime, which also keeps golden rule 5 honest on a school network that
 * may block Google's font CDN outright.
 */
const switzer = localFont({
  src: "./fonts/Switzer-Variable.woff2",
  variable: "--font-switzer",
  display: "swap",
  // The file's real axis, read from its fvar table rather than assumed:
  // wght 100–900, default 400. DESIGN.md restricts *usage* to 400/500/600 —
  // that restraint belongs in review, not in a clamped axis that would
  // silently render a stray `font-bold` at 600 with no error.
  weight: "100 900",
  style: "normal",
  // Next synthesizes a metric-matched fallback from Arial's metrics, so the
  // swap from system font to Switzer doesn't reflow the page. On a throttled
  // Chromebook that reflow is the most visible thing on screen.
  adjustFontFallback: "Arial",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RoundZero",
  description:
    "Free, open-source, browser-based training platform for CyberPatriot teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables go on <html> because globals.css resolves
    // --font-body in :root, which IS html — declaring them on <body> would
    // leave the :root reference unresolved and silently fall back.
    <html
      lang="en"
      className={`${switzer.variable} ${plexMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}
