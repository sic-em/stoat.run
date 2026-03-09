'use client';

import { useEffect, useRef } from 'react';

export function ClickSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio('/tap_05.wav');
    audio.preload = 'auto';
    audioRef.current = audio;

    function handleClick(e: MouseEvent) {
      const target = e.target as Element;
      if (!target.closest('button, a[href]')) return;

      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}
