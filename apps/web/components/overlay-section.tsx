import { InlineCode } from '@/components/inline-code';
import { InstallTabs } from '@/components/install-tabs';
import { ShikiBlock } from '@/components/shiki-block';
import type { HighlightedMethod } from '@/lib/types';

interface OverlaySectionProps {
  methods: HighlightedMethod[];
  usageHtml: string;
}

export function OverlaySection({ methods, usageHtml }: OverlaySectionProps) {
  return (
    <div className="space-y-4">
      <p className="font-medium text-foreground text-sm">react overlay</p>
      <p className="text-muted-foreground text-sm leading-relaxed">
        drop <InlineCode>StoatOverlay</InlineCode> into your app to show a live tunnel status bar.
      </p>
      <InstallTabs methods={methods} />
      <div className="rounded-md border">
        <ShikiBlock html={usageHtml} variant="scrollable" />
      </div>
    </div>
  );
}
