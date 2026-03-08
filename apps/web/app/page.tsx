import Image from 'next/image';
import { codeToHtml } from 'shiki';
import { HomeHero } from '@/components/home-hero';
import type { HighlightedMethod } from '@/lib/types';

const shikiOptions = {
  themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
  defaultColor: false,
} as const;

type RawMethod = Omit<HighlightedMethod, 'html'>;

async function highlightMethods(methods: RawMethod[]): Promise<HighlightedMethod[]> {
  return Promise.all(
    methods.map(async (m) => ({
      ...m,
      html: await codeToHtml(m.command, { lang: 'shell', ...shikiOptions }),
    })),
  );
}

const installMethods: RawMethod[] = [
  { id: 'npm', label: 'npm', command: 'npm i -g stoat.run@latest' },
  { id: 'pnpm', label: 'pnpm', command: 'pnpm add -g stoat.run@latest' },
  { id: 'bun', label: 'bun', command: 'bun add -g stoat.run@latest' },
  { id: 'yarn', label: 'yarn', command: 'yarn global add stoat.run@latest' },
  { id: 'npx', label: 'npx', command: 'npx stoat.run http 3000' },
];

const overlayMethods: RawMethod[] = [
  { id: 'npm', label: 'npm', command: 'npm i @stoat-run/overlay' },
  { id: 'pnpm', label: 'pnpm', command: 'pnpm add @stoat-run/overlay' },
  { id: 'bun', label: 'bun', command: 'bun add @stoat-run/overlay' },
  { id: 'yarn', label: 'yarn', command: 'yarn add @stoat-run/overlay' },
];

const overlayUsageSnippet = `import { StoatOverlay } from "@stoat-run/overlay";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <StoatOverlay slug="hidden-peek-2249" />
    </>
  );
}`;

export default async function Home() {
  const [highlighted, overlayHighlighted, overlayUsageHtml] = await Promise.all([
    highlightMethods(installMethods),
    highlightMethods(overlayMethods),
    codeToHtml(overlayUsageSnippet, { lang: 'tsx', ...shikiOptions }),
  ]);

  return (
    <main className="flex min-h-screen flex-col items-center">
      <div className="w-full max-w-2xl px-8 pt-48 pb-12">
        <HomeHero
          logo={
            <Image src="/stoat.webp" alt="stoat.run" width={120} height={120} draggable={false} quality={100} sizes="120px" />
          }
          highlighted={highlighted}
          overlayHighlighted={overlayHighlighted}
          overlayUsageHtml={overlayUsageHtml}
        />
      </div>
    </main>
  );
}
