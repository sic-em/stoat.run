'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
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

const TYPE_MS = 42;
const DELETE_MS = 28;
const HOLD_MS = 1100;
const BETWEEN_MS = 240;
const REDUCED_ROTATE_MS = 2400;

interface TypewriterOption {
  command: string;
  html: string;
}

const FALLBACK_OPTION: TypewriterOption = { command: '', html: '' };

function TypewriterCommand({
  options,
  onCommandChange,
}: {
  options: TypewriterOption[];
  onCommandChange: (command: string) => void;
}) {
  const reduced = useReducedMotion();
  const [optionIndex, setOptionIndex] = useState(0);
  const [visibleChars, setVisibleChars] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'pausing' | 'deleting'>('typing');

  const hasOptions = options.length > 0;
  const safeOptions = hasOptions ? options : [FALLBACK_OPTION];
  const option = safeOptions[optionIndex % safeOptions.length] ?? FALLBACK_OPTION;
  const { command, html } = option;
  const revealRatio = command.length > 0 ? visibleChars / command.length : 0;
  useEffect(() => {
    if (!hasOptions) return;
    onCommandChange(command);
  }, [command, hasOptions, onCommandChange]);

  useEffect(() => {
    if (!hasOptions) return;
    if (reduced) {
      setVisibleChars(command.length);
      const timer = window.setTimeout(() => {
        setOptionIndex((prev) => (prev + 1) % options.length);
      }, REDUCED_ROTATE_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'typing') {
      if (visibleChars < command.length) {
        const timer = window.setTimeout(() => setVisibleChars((prev) => prev + 1), TYPE_MS);
        return () => window.clearTimeout(timer);
      }
      const timer = window.setTimeout(() => setPhase('pausing'), HOLD_MS);
      return () => window.clearTimeout(timer);
    }

    if (phase === 'pausing') {
      const timer = window.setTimeout(() => setPhase('deleting'), BETWEEN_MS);
      return () => window.clearTimeout(timer);
    }

    if (visibleChars > 0) {
      const timer = window.setTimeout(() => setVisibleChars((prev) => prev - 1), DELETE_MS);
      return () => window.clearTimeout(timer);
    }

    setOptionIndex((prev) => (prev + 1) % options.length);
    setPhase('typing');
  }, [command, hasOptions, options.length, phase, reduced, visibleChars]);

  return (
    <div
      className="relative min-w-0 max-w-full [&_pre]:w-fit [&_pre]:max-w-full [&_pre]:overflow-hidden"
      aria-live="polite"
    >
      <div className="opacity-0">
        <ShikiBlock html={html} />
      </div>

      <div
        className="absolute inset-0 overflow-hidden"
        style={reduced ? undefined : { clipPath: `inset(0 ${100 - revealRatio * 100}% 0 0)` }}
      >
        <ShikiBlock html={html} />
      </div>

      <motion.span
        aria-hidden="true"
        animate={reduced ? { opacity: 1 } : { opacity: [1, 0.2, 1] }}
        transition={
          reduced ? { duration: 0 } : { duration: 0.8, repeat: Infinity, ease: 'easeOut' }
        }
        className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-foreground/80"
        style={{ left: `${reduced ? 100 : revealRatio * 100}%` }}
      />
    </div>
  );
}

export function InstallTabs({
  methods,
  npxTypewriterOptions,
}: {
  methods: HighlightedMethod[];
  npxTypewriterOptions?: TypewriterOption[];
}) {
  const [npxCopyText, setNpxCopyText] = useState(npxTypewriterOptions?.[0]?.command ?? '');

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
          <div className="flex h-10 items-center gap-2 rounded-md border pr-1.5 pl-3">
            {m.id === 'npx' ? (
              npxTypewriterOptions && npxTypewriterOptions.length > 0 ? (
                <>
                  <TypewriterCommand
                    options={npxTypewriterOptions}
                    onCommandChange={setNpxCopyText}
                  />
                  <div className="ml-auto">
                    <CopyButton text={npxCopyText} />
                  </div>
                </>
              ) : (
                <>
                  <ShikiBlock html={m.html} />
                  <div className="ml-auto">
                    <CopyButton text={m.command} />
                  </div>
                </>
              )
            ) : (
              <>
                <ShikiBlock html={m.html} />
                <div className="ml-auto">
                  <CopyButton text={m.command} />
                </div>
              </>
            )}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
