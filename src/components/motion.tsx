"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

/** Strong ease-out used for everything that enters or responds. */
export const EASE = [0.2, 0, 0, 1] as const;
/** iOS-like curve for sheets. */
export const EASE_SHEET = [0.32, 0.72, 0, 1] as const;

/**
 * Content settling into place when a screen opens. One short pass per screen; rows inside lists do not
 * animate individually, so a long round stays fast to scan.
 */
export function Rise({ i = 0, children, className, ...rest }: HTMLMotionProps<"div"> & { i?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      // Same starting state on server and client (avoids a hydration mismatch); reduced motion just skips the movement.
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.22, ease: EASE, delay: Math.min(i, 5) * 0.03 }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
