import type { Metadata, Viewport } from "next";
import { Geist_Mono, DM_Sans } from "next/font/google";
import { Providers } from "./providers";
import { SmoothScroll } from "@/components/SmoothScroll";
import { SceneBackground } from "@/components/SceneBackground";
import { Nav } from "@/components/Nav";
import "./globals.css";

/** Headlines and labels: Geist Mono, the same font IdleNet uses on its button - applied everywhere, not just
 * code/labels. Body/paragraph text: DM Sans, matched from IdleNet's own headings and copy. */
const display = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-display", display: "swap" });
const sans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Forge",
  description: "Build your token's economy with cards.",
  openGraph: {
    title: "Forge",
    description: "Every token has a deck. Trading builds it. Cards change the token.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `if ("scrollRestoration" in history) history.scrollRestoration = "manual";`,
          }}
        />
      </head>
      <body>
        <Providers>
          <SceneBackground />
          <Nav />
          <div className="page">{children}</div>
        </Providers>
        <SmoothScroll />
      </body>
    </html>
  );
}
