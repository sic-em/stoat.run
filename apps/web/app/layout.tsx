import { Analytics } from '@vercel/analytics/next';
import type { Metadata } from 'next';
import { Geist, JetBrains_Mono } from 'next/font/google';
import Script from 'next/script';
import '@/app/globals.css';
import { ClickSound } from '@/components/click-sound';
import { GitHubLink } from '@/components/github-link';
import { ThemeProvider } from '@/components/theme-provider';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { cn } from '@/lib/utils';

const fontSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
});

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

const description =
  'expose your local server to the internet with one tiny command. no signup, no config — just stoat http 3000.';

export const metadata: Metadata = {
  metadataBase: new URL('https://stoat.run'),
  title: {
    default: 'stoat.run — tiny tunnels for localhost',
    template: '%s | stoat.run',
  },
  description,
  openGraph: {
    description,
    type: 'website',
    url: 'https://stoat.run',
    siteName: 'stoat.run',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    description,
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
      className={cn('antialiased', fontMono.variable, 'font-sans', fontSans.variable)}
    >
      <head>
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <div className="mx-auto w-full max-w-7xl">
            <header className="absolute top-0 right-0 left-0 z-50">
              <div className="mx-auto flex max-w-7xl items-center justify-end px-8 py-4">
                <ThemeSwitcher />
                <GitHubLink />
              </div>
            </header>
            {children}
            <Analytics />
          </div>
        </ThemeProvider>
        <ClickSound />
      </body>
    </html>
  );
}
