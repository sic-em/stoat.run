'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeSwitcher() {
  const { resolvedTheme, setTheme } = useTheme();
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';

  return (
    <motion.button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={{
        opacity: { duration: 0.24, ease: [0.32, 0.72, 0, 1] },
        y: { duration: 0.24, ease: [0.32, 0.72, 0, 1] },
        scale: { type: 'spring', stiffness: 400, damping: 17 },
      }}
      className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Toggle theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        {mounted &&
          (isDark ? (
            <motion.span
              key="sun"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, rotate: -45 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, rotate: 45 }}
              transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
            >
              <Sun className="h-4 w-4" />
            </motion.span>
          ) : (
            <motion.span
              key="moon"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, rotate: 45 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, rotate: -45 }}
              transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
            >
              <Moon className="h-4 w-4" />
            </motion.span>
          ))}
      </AnimatePresence>
    </motion.button>
  );
}
