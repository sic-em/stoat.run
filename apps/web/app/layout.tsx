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
  title: "Ferret — Share localhost in one command",
  description:
    "Expose your local dev server to the internet instantly. No signup, no config — just ferret http 3000.",
  openGraph: {
    title: "Ferret — Share localhost in one command",
    description:
      "Expose your local dev server to the internet instantly. No signup, no config.",
    type: "website",
    siteName: "Ferret",
  },
  twitter: {
    card: "summary_large_image",
    title: "Ferret — Share localhost in one command",
    description: "Expose your local dev server instantly with one command.",
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
