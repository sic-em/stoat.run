import type { OverlayRequestEvent } from '@/components/overlay-preview/types';
import { formatDetailMap, getStatusVariant } from '@/components/overlay-preview/utils';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface OverlayEventRowProps {
  readonly event: OverlayRequestEvent;
  readonly time: string;
  readonly expanded: boolean;
  readonly onToggle: (id: string) => void;
}

export function OverlayEventRow({ event, time, expanded, onToggle }: OverlayEventRowProps) {
  const statusVariant = getStatusVariant(event.status);
  const slowClass = event.latencyMs > 800 ? 'font-semibold text-foreground' : '';

  return (
    <Collapsible
      open={expanded}
      onOpenChange={() => onToggle(event.id)}
      className="border-b last:border-b-0"
    >
      <CollapsibleTrigger className="grid w-full cursor-pointer grid-cols-[66px_50px_1fr_60px_60px] items-center gap-2 bg-transparent px-3 py-[7px] text-left font-mono text-[11px] text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70">
        <span>{time}</span>
        <span>{event.method}</span>
        <span className="truncate">{event.path}</span>
        <span className="inline-flex items-center justify-center">
          <Badge
            variant={statusVariant}
            className={cn(
              'border border-border',
              statusVariant === 'destructive' &&
                'bg-destructive/30 text-destructive dark:bg-destructive dark:text-red-500',
            )}
          >
            {event.status}
          </Badge>
        </span>
        <span className={cn('whitespace-nowrap', slowClass)}>{event.latencyMs}ms</span>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden">
        <div className="px-3 pb-2.5 font-mono text-[11px] text-muted-foreground leading-[1.4]">
          <div className="mt-1 grid grid-cols-[68px_1fr] gap-x-2 gap-y-1 whitespace-pre-wrap wrap-break-word">
            <span className="text-muted-foreground">traceId</span>
            <span>{event.traceId ?? 'none'}</span>
            <span className="text-muted-foreground">reqBytes</span>
            <span>{event.reqBytes}</span>
            <span className="text-muted-foreground">resBytes</span>
            <span>{event.resBytes}</span>
            <span className="text-muted-foreground">userAgent</span>
            <span>{event.userAgent ?? 'none'}</span>
            <span className="text-muted-foreground">query</span>
            <span>{formatDetailMap(event.query)}</span>
            <span className="text-muted-foreground">headers</span>
            <span>{formatDetailMap(event.headers)}</span>
            <span className="text-muted-foreground">error</span>
            <span>{event.error ? JSON.stringify(event.error) : 'none'}</span>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
