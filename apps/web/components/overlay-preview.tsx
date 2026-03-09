'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MOCK_EVENTS } from '@/components/overlay-preview/mock-data';
import { OverlayBar } from '@/components/overlay-preview/overlay-bar';
import { OverlayDrawer } from '@/components/overlay-preview/overlay-drawer';
import type { OverlayEventRowModel, OverlayRequestEvent } from '@/components/overlay-preview/types';
import { COPY_RESET_MS, OVERLAY_TRANSITION } from '@/components/overlay-preview/utils';
import { Button } from '@/components/ui/button';
import { useOverlayDrag } from '@/hooks/use-overlay-drag';
import { cn } from '@/lib/utils';

interface MockOverlayProps {
  readonly onClose: () => void;
}

function MockOverlay({ onClose }: MockOverlayProps) {
  const [copied, setCopied] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [events, setEvents] = useState<OverlayRequestEvent[]>(() => [...MOCK_EVENTS]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const reduced = useReducedMotion();
  const isReducedMotion = Boolean(reduced);
  const resetCopyTimeoutRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  const { position, wrapWidth, isDragging, beginDrag, prepareDrawerToggle } = useOverlayDrag({
    drawerOpen,
    wrapRef,
    barRef,
    drawerRef,
  });

  useEffect(() => {
    return () => {
      if (resetCopyTimeoutRef.current !== null) {
        window.clearTimeout(resetCopyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(() => {
    if (resetCopyTimeoutRef.current !== null) {
      window.clearTimeout(resetCopyTimeoutRef.current);
    }
    setCopied(true);
    resetCopyTimeoutRef.current = window.setTimeout(() => setCopied(false), COPY_RESET_MS);
  }, []);

  const onRowToggle = useCallback((id: string) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const eventRows = useMemo<OverlayEventRowModel[]>(() => {
    return events.map((event) => {
      const date = new Date(event.ts);
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      const ss = String(date.getSeconds()).padStart(2, '0');
      return {
        event,
        time: `${hh}:${mm}:${ss}`,
        expanded: expandedIds.has(event.id),
      };
    });
  }, [events, expandedIds]);

  const handleDrawerToggle = useCallback(() => {
    prepareDrawerToggle();
    setDrawerOpen((previous) => !previous);
  }, [prepareDrawerToggle]);

  const handleClear = useCallback(() => {
    setEvents([]);
    setExpandedIds(new Set());
  }, []);

  const handleCopyVisible = useCallback(async () => {
    await navigator.clipboard.writeText(JSON.stringify(events, null, 2));
  }, [events]);

  return (
    <motion.div
      initial={isReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={isReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
      transition={OVERLAY_TRANSITION}
      role="region"
      aria-label="Tunnel overlay preview"
      ref={wrapRef}
      style={
        position ? { left: position.x, top: position.y, width: wrapWidth || undefined } : undefined
      }
      className={cn(
        'fixed z-50 touch-none select-none transition-[width] duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]',
        !position && 'bottom-6 left-1/2 -translate-x-1/2',
      )}
    >
      <AnimatePresence initial={false}>
        {drawerOpen ? (
          <OverlayDrawer
            reduced={isReducedMotion}
            isDragging={isDragging}
            eventRows={eventRows}
            onBeginDrag={beginDrag}
            onClear={handleClear}
            onCopyVisible={handleCopyVisible}
            onRowToggle={onRowToggle}
            drawerRef={drawerRef}
          />
        ) : null}
      </AnimatePresence>

      <OverlayBar
        drawerOpen={drawerOpen}
        copied={copied}
        isDragging={isDragging}
        onCopy={handleCopy}
        onToggleDrawer={handleDrawerToggle}
        onClose={onClose}
        onBeginDrag={beginDrag}
        barRef={barRef}
      />
    </motion.div>
  );
}

export function OverlayPreview() {
  const [visible, setVisible] = useState(false);
  const closeOverlay = useCallback(() => setVisible(false), []);
  const openOverlay = useCallback(() => setVisible(true), []);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeOverlay();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeOverlay, visible]);

  return (
    <div>
      <Button
        variant="outline"
        onClick={openOverlay}
        className="h-9 w-fit cursor-pointer border-border px-3 text-foreground hover:bg-muted hover:text-foreground"
      >
        Show Demo
      </Button>
      <AnimatePresence>{visible ? <MockOverlay onClose={closeOverlay} /> : null}</AnimatePresence>
    </div>
  );
}
