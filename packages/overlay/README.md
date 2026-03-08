# @stoat-run/overlay

Overlay helpers for stoat.run tunnels.

## Install

```bash
npm i @stoat-run/overlay
```

## React

```tsx
import { StoatOverlay } from "@stoat-run/overlay";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <StoatOverlay slug="hidden-peek-2249" />
    </>
  );
}
```
