"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * FLIP animation for the pitch chips: call `snapshot()` right before a lineup
 * change, and every registered chip that moved glides from its old position to
 * its new one. Honours prefers-reduced-motion.
 *
 *   const { register, snapshot } = useFlip(lineup);
 *   <PlayerChip ref={register(player.id)} ... />
 */
export function useFlip(dependency: unknown) {
  const nodes = useRef(new Map<string, HTMLElement>());
  const previousRects = useRef<Map<string, DOMRect> | null>(null);

  useLayoutEffect(() => {
    const before = previousRects.current;
    previousRects.current = null;
    if (!before) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    for (const [id, element] of nodes.current) {
      const from = before.get(id);
      if (!from) continue;
      const to = element.getBoundingClientRect();
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
      element.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)`, zIndex: "10" },
          { transform: "translate(0, 0)", zIndex: "10" },
        ],
        { duration: 350, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
      );
    }
  }, [dependency]);

  /** Capture current positions. Call immediately before applying the change. */
  function snapshot() {
    previousRects.current = new Map(
      [...nodes.current].map(([id, element]) => [
        id,
        element.getBoundingClientRect(),
      ])
    );
  }

  function register(id: string) {
    return (element: HTMLElement | null) => {
      if (element) nodes.current.set(id, element);
      else nodes.current.delete(id);
    };
  }

  return { register, snapshot };
}
