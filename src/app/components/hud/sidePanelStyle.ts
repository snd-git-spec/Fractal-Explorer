import type { CSSProperties } from 'react';

const BASE =
  'hud-glass absolute overflow-y-auto pointer-events-auto px-[14px] py-[12px] [&::-webkit-scrollbar]:hidden';

/** Right-hand Express/Lab panel. On phones it is pinned between the top and bottom button rows. */
export function sidePanelProps(isDesktop: boolean): { className: string; style: CSSProperties } {
  if (isDesktop) {
    return {
      className: `${BASE} top-1/2 -translate-y-1/2 w-[178px] max-h-[min(78vh,580px)]`,
      style: { right: 'max(10px, var(--hud-safe-right))', scrollbarWidth: 'none' },
    };
  }
  return {
    className: `${BASE} w-[168px]`,
    style: {
      right: 'max(10px, var(--hud-safe-right))',
      top: 'calc(80px + var(--hud-safe-top))',
      maxHeight: 'calc(100dvh - 144px - var(--hud-safe-top) - var(--hud-safe-bottom))',
      scrollbarWidth: 'none',
    },
  };
}
