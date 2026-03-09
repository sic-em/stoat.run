'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { GitHubIcon } from '@/components/icons/github-icon';

export function GitHubLink() {
  const reduced = useReducedMotion();

  return (
    <motion.a
      href="https://github.com/sic-em/stoat.run"
      target="_blank"
      rel="noopener noreferrer"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={reduced ? undefined : { scale: 0.97 }}
      transition={{
        opacity: { duration: 0.24, ease: [0.32, 0.72, 0, 1], delay: 0.08 },
        y: { duration: 0.24, ease: [0.32, 0.72, 0, 1], delay: 0.08 },
        scale: { type: 'spring', stiffness: 400, damping: 17 },
      }}
      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
    >
      <GitHubIcon className="h-4 w-4" />
      Source
    </motion.a>
  );
}
