"use client";
import { useEffect } from "react";

interface FerretOverlayProps {
  slug: string;
}

export function FerretOverlay({ slug }: FerretOverlayProps): null {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const script = document.createElement("script");
    script.src = `/.ferret/overlay.js?slug=${encodeURIComponent(slug)}`;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [slug]);

  return null;
}
