import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OverlayPosition } from '@/components/overlay-preview/types';
import {
  clamp,
  DEFAULT_BOTTOM_OFFSET,
  DRAWER_MIN_WIDTH,
  EDGE_MARGIN,
  isFiniteNumber,
  STORAGE_KEY,
} from '@/components/overlay-preview/utils';

export interface UseOverlayDragProps {
  readonly drawerOpen: boolean;
  readonly wrapRef: RefObject<HTMLDivElement | null>;
  readonly barRef: RefObject<HTMLDivElement | null>;
  readonly drawerRef: RefObject<HTMLDivElement | null>;
}

export interface UseOverlayDragResult {
  readonly position: OverlayPosition | null;
  readonly wrapWidth: number;
  readonly isDragging: boolean;
  readonly beginDrag: (event: React.PointerEvent<HTMLElement>) => void;
  readonly prepareDrawerToggle: () => void;
}

export function useOverlayDrag({
  drawerOpen,
  wrapRef,
  barRef,
  drawerRef,
}: UseOverlayDragProps): UseOverlayDragResult {
  const [position, setPosition] = useState<OverlayPosition | null>(null);
  const [baseWrapWidth, setBaseWrapWidth] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragStateRef = useRef({ active: false, offsetX: 0, offsetY: 0 });
  const pendingCenterRef = useRef<number | null>(null);
  const positionRef = useRef<OverlayPosition | null>(null);

  const wrapWidth = useMemo(
    () => (drawerOpen ? Math.max(baseWrapWidth, DRAWER_MIN_WIDTH) : baseWrapWidth),
    [baseWrapWidth, drawerOpen],
  );

  const getTopGuardOffset = useCallback(
    (open: boolean) => {
      if (!open) return 0;
      const drawerHeight = Math.ceil(drawerRef.current?.getBoundingClientRect().height ?? 0);
      return Math.max(0, drawerHeight - 1);
    },
    [drawerRef],
  );

  const getBounds = useCallback(
    (rect: DOMRect, open: boolean) => {
      const minX = EDGE_MARGIN;
      const maxX = Math.max(minX, window.innerWidth - rect.width - EDGE_MARGIN);
      const minY = EDGE_MARGIN + getTopGuardOffset(open);
      const maxY = Math.max(minY, window.innerHeight - rect.height - EDGE_MARGIN);
      return { minX, maxX, minY, maxY };
    },
    [getTopGuardOffset],
  );

  const savePosition = useCallback((next: OverlayPosition) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore preview storage failures
    }
  }, []);

  const placeByState = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const rect = wrap.getBoundingClientRect();
    const bounds = getBounds(rect, drawerOpen);
    let nextX = clamp((window.innerWidth - rect.width) / 2, bounds.minX, bounds.maxX);
    let nextY = clamp(
      window.innerHeight - rect.height - DEFAULT_BOTTOM_OFFSET,
      bounds.minY,
      bounds.maxY,
    );

    try {
      const savedRaw = window.localStorage.getItem(STORAGE_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw) as Partial<Record<'x' | 'y', unknown>>;
        if (isFiniteNumber(parsed.x)) {
          nextX = clamp(parsed.x, bounds.minX, bounds.maxX);
        }
        if (isFiniteNumber(parsed.y)) {
          nextY = clamp(parsed.y, bounds.minY, bounds.maxY);
        }
      }
    } catch {
      // ignore parse failures
    }

    const next = { x: nextX, y: nextY };
    positionRef.current = next;
    setPosition(next);
  }, [drawerOpen, getBounds, wrapRef]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    if (drawerOpen) return;
    const bar = barRef.current;
    if (!bar) return;

    const measure = () => {
      const width = Math.ceil(bar.getBoundingClientRect().width);
      if (width > 0) {
        setBaseWrapWidth((prev) => (prev === width ? prev : width));
      }
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, [barRef, drawerOpen]);

  useEffect(() => {
    if (!baseWrapWidth) return;
    if (positionRef.current) return;
    placeByState();
  }, [baseWrapWidth, placeByState]);

  useEffect(() => {
    const current = positionRef.current;
    if (!current) return;

    const onResize = () => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const bounds = getBounds(rect, drawerOpen);
      const next = {
        x: clamp(current.x, bounds.minX, bounds.maxX),
        y: clamp(current.y, bounds.minY, bounds.maxY),
      };
      positionRef.current = next;
      setPosition(next);
      savePosition(next);
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [drawerOpen, getBounds, savePosition, wrapRef]);

  useEffect(() => {
    const current = positionRef.current;
    const center = pendingCenterRef.current;
    if (!current || center === null) return;

    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const bounds = getBounds(rect, drawerOpen);
    const next = {
      x: clamp(center - rect.width / 2, bounds.minX, bounds.maxX),
      y: clamp(current.y, bounds.minY, bounds.maxY),
    };
    positionRef.current = next;
    setPosition(next);
    savePosition(next);
    pendingCenterRef.current = null;
  }, [drawerOpen, getBounds, savePosition, wrapRef]);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragStateRef.current.active) return;

      const wrap = wrapRef.current;
      if (!wrap) return;

      const rect = wrap.getBoundingClientRect();
      const bounds = getBounds(rect, drawerOpen);
      const next = {
        x: clamp(event.clientX - dragStateRef.current.offsetX, bounds.minX, bounds.maxX),
        y: clamp(event.clientY - dragStateRef.current.offsetY, bounds.minY, bounds.maxY),
      };

      positionRef.current = next;
      setPosition(next);
    },
    [drawerOpen, getBounds, wrapRef],
  );

  const stopDragging = useCallback(() => {
    if (!dragStateRef.current.active) return;

    dragStateRef.current.active = false;
    setIsDragging(false);
    if (positionRef.current) {
      savePosition(positionRef.current);
    }

    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDragging);
    window.removeEventListener('pointercancel', stopDragging);
  }, [onPointerMove, savePosition]);

  const beginDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const wrap = wrapRef.current;
      if (!wrap) return;

      const rect = wrap.getBoundingClientRect();
      dragStateRef.current.active = true;
      dragStateRef.current.offsetX = event.clientX - rect.left;
      dragStateRef.current.offsetY = event.clientY - rect.top;
      setIsDragging(true);
      event.preventDefault();

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', stopDragging);
      window.addEventListener('pointercancel', stopDragging);
    },
    [onPointerMove, stopDragging, wrapRef],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [onPointerMove, stopDragging]);

  const prepareDrawerToggle = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    pendingCenterRef.current = rect.left + rect.width / 2;
  }, [wrapRef]);

  return {
    position,
    wrapWidth,
    isDragging,
    beginDrag,
    prepareDrawerToggle,
  };
}
