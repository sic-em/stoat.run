'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { type ReactNode, useMemo } from 'react';
import { GetRunning } from '@/components/get-running';
import { InstallTabs } from '@/components/install-tabs';
import { OverlaySection } from '@/components/overlay-section';
import type { HighlightedMethod } from '@/lib/types';

const EASING = [0.32, 0.72, 0, 1] as const;
const DURATION = 0.24;
const STAGGER = 0.08;

const containerVariants = { show: { transition: { staggerChildren: STAGGER } } };

interface HomeHeroProps {
  logo: ReactNode;
  highlighted: HighlightedMethod[];
  overlayHighlighted: HighlightedMethod[];
  overlayUsageHtml: string;
}

export function HomeHero({
  logo,
  highlighted,
  overlayHighlighted,
  overlayUsageHtml,
}: HomeHeroProps) {
  const reduced = useReducedMotion();

  const itemVariants = useMemo(
    () => ({
      hidden: { opacity: 0, y: reduced ? 0 : 12 },
      show: { opacity: 1, y: 0, transition: { duration: DURATION, ease: EASING } },
    }),
    [reduced],
  );

  return (
    <motion.div className="space-y-8" initial="hidden" animate="show" variants={containerVariants}>
      <motion.div variants={itemVariants}>{logo}</motion.div>

      <motion.p variants={itemVariants} className="text-base text-foreground leading-relaxed">
        stoat.run gives your localhost a public URL in seconds. no signup, no config, no dashboard —
        just run one command and share the link.
      </motion.p>

      <motion.div variants={itemVariants}>
        <InstallTabs methods={highlighted} />
      </motion.div>

      <motion.div variants={itemVariants}>
        <GetRunning />
      </motion.div>

      <motion.div variants={itemVariants}>
        <OverlaySection methods={overlayHighlighted} usageHtml={overlayUsageHtml} />
      </motion.div>
    </motion.div>
  );
}
