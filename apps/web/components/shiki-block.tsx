import { cn } from '@/lib/utils';

interface ShikiBlockProps {
  html: string;
  variant?: 'compact' | 'scrollable';
}

const variantClasses = {
  compact: '[&_pre]:bg-transparent [&_pre]:p-0 [&_code]:bg-transparent',
  scrollable: '[&_pre]:overflow-x-auto [&_pre]:p-4 [&_code]:bg-transparent',
};

export function ShikiBlock({ html, variant = 'compact' }: ShikiBlockProps) {
  return (
    <div
      className={cn('shiki-block text-[13px]', variantClasses[variant])}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted shiki output
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
