'use client';

import { CopyButton } from '@/components/copy-button';
import { BunIcon, NpmIcon, NpxIcon, PnpmIcon, YarnIcon } from '@/components/icons/package-managers';
import { ShikiBlock } from '@/components/shiki-block';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { HighlightedMethod } from '@/lib/types';

const pmIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  npm: NpmIcon,
  pnpm: PnpmIcon,
  bun: BunIcon,
  yarn: YarnIcon,
  npx: NpxIcon,
};

export function InstallTabs({ methods }: { methods: HighlightedMethod[] }) {
  return (
    <Tabs defaultValue={methods[0]?.id}>
      <TabsList className="h-auto gap-1 bg-background p-0">
        {methods.map((m) => {
          const Icon = pmIcons[m.id];
          return (
            <TabsTrigger
              key={m.id}
              value={m.id}
              className="gap-1.5 border border-transparent data-active:border-border data-active:shadow-none"
            >
              {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
              {m.label}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {methods.map((m) => (
        <TabsContent key={m.id} value={m.id}>
          <div className="flex h-10 items-center justify-between gap-2 rounded-md border pr-1.5 pl-3">
            <ShikiBlock html={m.html} />
            <CopyButton text={m.command} />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
