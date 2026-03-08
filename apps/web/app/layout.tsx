import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "@/app/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "stoat.run — tiny tunnels for localhost",
  description:
    "expose your local server to the internet with one tiny command. no signup, no config — just stoat http 3000.",
  openGraph: {
    title: "stoat.run — tiny tunnels for localhost",
    description:
      "fast, simple localhost sharing with public urls in seconds.",
    type: "website",
    siteName: "stoat.run",
  },
  twitter: {
    card: "summary_large_image",
    title: "stoat.run — tiny tunnels for localhost",
    description: "fast, simple localhost sharing in seconds.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", fontSans.variable)}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
