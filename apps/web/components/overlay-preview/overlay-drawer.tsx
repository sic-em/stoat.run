import { motion } from 'framer-motion';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { OverlayEventRow } from '@/components/overlay-preview/event-row';
import type { OverlayEventRowModel } from '@/components/overlay-preview/types';
import { EASING } from '@/components/overlay-preview/utils';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface OverlayDrawerProps {
  readonly reduced: boolean;
  readonly isDragging: boolean;
  readonly eventRows: readonly OverlayEventRowModel[];
  readonly onBeginDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onClear: () => void;
  readonly onCopyVisible: () => Promise<void>;
  readonly onRowToggle: (id: string) => void;
  readonly drawerRef: RefObject<HTMLDivElement | null>;
}

export function OverlayDrawer({
  reduced,
  isDragging,
  eventRows,
  onBeginDrag,
  onClear,
  onCopyVisible,
  onRowToggle,
  drawerRef,
}: OverlayDrawerProps) {
  return (
    <motion.div
      initial={
        reduced
          ? { opacity: 0 }
          : { opacity: 0, y: 6, clipPath: 'inset(98% 0 0 0 round 12px 12px 0 0)' }
      }
      animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0 0 round 12px 12px 0 0)' }}
      exit={
        reduced
          ? { opacity: 0 }
          : { opacity: 0, y: 6, clipPath: 'inset(98% 0 0 0 round 12px 12px 0 0)' }
      }
      transition={{ duration: 0.22, ease: EASING }}
      ref={drawerRef}
      className="absolute bottom-[calc(100%-1px)] left-0 box-border w-full rounded-t-xl border border-b-0 bg-card text-card-foreground shadow-lg"
    >
      <div
        onPointerDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('button')) return;
          if (target.closest('[data-events-list]')) return;
          onBeginDrag(event);
        }}
        className={cn(
          'flex cursor-grab gap-1.5 border-b px-3 py-2.5',
          isDragging && 'cursor-grabbing',
        )}
      >
        <Button
          onClick={onClear}
          className="h-8 gap-1 whitespace-nowrap px-2 text-muted-foreground text-xs hover:text-foreground"
          variant="ghost"
        >
          Clear
        </Button>
        <Button
          onClick={() => {
            void onCopyVisible();
          }}
          variant="ghost"
          className="h-8 gap-1 whitespace-nowrap px-2 text-muted-foreground text-xs hover:text-foreground"
        >
          Copy Visible
        </Button>
      </div>

      <div
        data-events-list
        className="h-[260px] overflow-y-auto overflow-x-hidden overscroll-contain text-[11px]"
      >
        {eventRows.length === 0 ? (
          <div className="px-3 py-4 text-muted-foreground">Waiting for events...</div>
        ) : (
          eventRows.map(({ event, time, expanded }) => (
            <OverlayEventRow
              key={event.id}
              event={event}
              time={time}
              expanded={expanded}
              onToggle={onRowToggle}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}
