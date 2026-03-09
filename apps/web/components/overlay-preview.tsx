'use client';

import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'framer-motion';
import { Check, Copy, Eye } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

const PRESS_SPRING = { type: 'spring', stiffness: 400, damping: 24 } as const;
const EASING = [0.32, 0.72, 0, 1] as const;
const OVERLAY_TRANSITION = { duration: 0.24, ease: EASING } as const;
const LABEL_TRANSITION = { duration: 0.16, ease: EASING } as const;
const PRESS_SCALE = { scale: 0.97 } as const;

function MockOverlay({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isPressingDragArea, setIsPressingDragArea] = useState(false);
  const reduced = useReducedMotion();
  const dragControls = useDragControls();
  const resetCopyTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetCopyTimeoutRef.current) {
        window.clearTimeout(resetCopyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(() => {
    if (resetCopyTimeoutRef.current) {
      window.clearTimeout(resetCopyTimeoutRef.current);
    }
    setCopied(true);
    resetCopyTimeoutRef.current = window.setTimeout(() => setCopied(false), 1500);
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest('button')) return;
      setIsPressingDragArea(true);
      dragControls.start(event);
    },
    [dragControls],
  );

  const handlePointerUp = useCallback(() => {
    setIsPressingDragArea(false);
  }, []);

  return (
    <motion.div
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
      transition={OVERLAY_TRANSITION}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragElastic={0.06}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => {
        setIsDragging(false);
        setIsPressingDragArea(false);
      }}
      role="region"
      aria-label="Tunnel overlay preview"
      className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 touch-none select-none items-center gap-1 rounded-xl border bg-card px-3 py-1.5 shadow-lg ${isDragging || isPressingDragArea ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      {/* Logo */}
      <Image
        src="/stoat-logo.webp"
        alt="stoat"
        width={200}
        height={200}
        className="size-9 shrink-0"
        draggable={false}
      />

      {/* Copy */}
      <motion.button
        type="button"
        onClick={handleCopy}
        whileTap={reduced ? undefined : PRESS_SCALE}
        transition={PRESS_SPRING}
        className="flex min-h-8 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="copied"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              transition={LABEL_TRANSITION}
              aria-live="polite"
              className="flex items-center gap-1"
            >
              <Check className="h-3.5 w-3.5" />
              Copied
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              transition={LABEL_TRANSITION}
              className="flex items-center gap-1"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy URL
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Close Tunnel */}
      <motion.button
        type="button"
        onClick={onClose}
        whileTap={reduced ? undefined : PRESS_SCALE}
        transition={PRESS_SPRING}
        className="min-h-8 cursor-pointer rounded-md px-2 py-1 text-muted-foreground text-xs transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Close Tunnel
      </motion.button>

      {/* Divider */}
      <div className="mx-0.5 h-3 w-px bg-border" />

      {/* Connected */}
      <div className="flex items-center gap-1.5 text-green-600 text-xs" aria-live="polite">
        <span className="relative flex h-1.5 w-1.5">
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
        </span>
        Connected
      </div>

      {/* Viewers */}
      <div className="ml-1 flex items-center gap-1 text-muted-foreground text-xs">
        <Eye className="h-3 w-3" />
        <span>0</span>
      </div>
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
        Open Preview
      </Button>
      <AnimatePresence>{visible ? <MockOverlay onClose={closeOverlay} /> : null}</AnimatePresence>
    </div>
  );
}
