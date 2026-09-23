import type { Metadata } from "next";
import { DM_Mono, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** The participant-facing terminal face. Admin stays on Geist. */
const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  weight: ["300", "400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Planet Sync",
  description: "Create and tune a shared planet system",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${geistSans.variable} ${geistMono.variable} ${dmMono.variable} h-full antialiased`}
    >
      {/*
        Browser extensions — Grammarly and password managers among them — write
        their own attributes onto <body> before React hydrates, which React then
        reports as a mismatch we did not cause and cannot prevent.

        This suppression reaches exactly one level: it covers this element's own
        attributes and text, and nothing inside it. A genuine mismatch in any
        component below still reports normally, which is what makes it safe to
        apply here and nowhere else.
      */}
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col font-sans"
      >
        {children}
      </body>
    </html>
  );
}
