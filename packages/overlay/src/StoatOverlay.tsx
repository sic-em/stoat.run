"use client";
import { useEffect } from "react";

interface StoatOverlayProps {
  slug: string;
}

export function StoatOverlay({ slug }: StoatOverlayProps): null {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const script = document.createElement("script");
    script.src = `/.stoat/overlay.js?slug=${encodeURIComponent(slug)}`;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [slug]);

  return null;
}
