import { BugIcon, CheckIcon, CopyIcon, EyeIcon, XIcon } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export interface OverlayBarProps {
  readonly drawerOpen: boolean;
  readonly copied: boolean;
  readonly isDragging: boolean;
  readonly onCopy: () => void;
  readonly onToggleDrawer: () => void;
  readonly onClose: () => void;
  readonly onBeginDrag: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly barRef: RefObject<HTMLDivElement | null>;
}

export function OverlayBar({
  drawerOpen,
  copied,
  isDragging,
  onCopy,
  onToggleDrawer,
  onClose,
  onBeginDrag,
  barRef,
}: OverlayBarProps) {
  return (
    <div
      ref={barRef}
      onPointerDown={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest('button')) return;
        onBeginDrag(event);
      }}
      className={cn(
        'flex items-center gap-1 rounded-xl border bg-card px-3 py-1.5 shadow-lg',
        drawerOpen ? 'w-full' : 'w-max',
        drawerOpen && 'rounded-t-none',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onCopy}
        className="h-8 gap-1 whitespace-nowrap px-2 text-muted-foreground text-xs hover:text-foreground"
      >
        <span
          className="relative inline-flex h-3.5 w-3.5 items-center justify-center"
          data-icon="inline-start"
        >
          <span
            className={cn(
              'absolute inset-0 inline-flex items-center justify-center transition-all duration-150',
              copied ? 'scale-95 opacity-0' : 'scale-100 opacity-100',
            )}
          >
            <CopyIcon />
          </span>
          <span
            className={cn(
              'absolute inset-0 inline-flex items-center justify-center transition-all duration-150',
              copied ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
            )}
          >
            <CheckIcon />
          </span>
        </span>
        Copy URL
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={onToggleDrawer}
        aria-expanded={drawerOpen}
        className="h-8 gap-1 whitespace-nowrap px-2 text-muted-foreground text-xs hover:text-foreground"
      >
        <BugIcon data-icon="inline-start" />
        <span>{drawerOpen ? 'Hide Debug' : 'Debug'}</span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        onClick={onClose}
        className="h-8 gap-1 whitespace-nowrap px-2 text-muted-foreground text-xs hover:text-foreground"
      >
        <XIcon data-icon="inline-start" />
        <span>Close Tunnel</span>
      </Button>

      <Separator orientation="vertical" className="mr-2 h-3 w-px" />

      <div className="inline-flex items-center gap-1.5 whitespace-nowrap text-foreground text-xs">
        <span className="size-1.5 rounded-full bg-primary" />
        Connected
      </div>
      <div className="ml-1 inline-flex items-center gap-1 text-muted-foreground text-xs">
        <EyeIcon className="size-3.5" data-icon="inline-start" />
        <span>1</span>
      </div>
    </div>
  );
}
