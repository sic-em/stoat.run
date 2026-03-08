import { InlineCode } from '@/components/inline-code';

const steps = [
  {
    step: '1',
    text: (
      <>
        install stoat globally or use <InlineCode>npx</InlineCode> to run it without installing.
      </>
    ),
  },
  {
    step: '2',
    text: (
      <>
        run <InlineCode>stoat http 3000</InlineCode> — replace <InlineCode>3000</InlineCode> with
        your local server port.
      </>
    ),
  },
  {
    step: '3',
    text: 'copy the public URL and share it — anyone with the link can reach your local server.',
  },
];

export function GetRunning() {
  return (
    <div className="space-y-4">
      <p className="font-medium text-foreground text-sm">get running</p>
      <ol className="space-y-3">
        {steps.map(({ step, text }) => (
          <li key={step} className="flex gap-3">
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] text-muted-foreground">
              {step}
            </span>
            <p className="text-muted-foreground text-sm leading-relaxed">{text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
