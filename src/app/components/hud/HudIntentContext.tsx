import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useIsDesktop } from '@/hooks/useMediaQuery';

export type LeftMenu = 'fractal' | 'palette' | null;

interface HudIntentValue {
  isDesktop: boolean;
  leftActive: boolean;
  rightActive: boolean;
  topActive: boolean;
  hintsVisible: boolean;
  dismissHints: () => void;
  leftOpacity: number;
  rightOpacity: number;
  topOpacity: number;
  /** Exclusive left-rail dropdown: fractal list or colour profiles. */
  leftMenu: LeftMenu;
  openLeftMenu: (menu: Exclude<LeftMenu, null>) => void;
  closeLeftMenu: () => void;
  toggleLeftMenu: (menu: Exclude<LeftMenu, null>) => void;
}

const HudIntentContext = createContext<HudIntentValue | null>(null);

const HINT_KEY = 'fe-hints-dismissed';

export function HudIntentProvider({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop();
  const [leftActive, setLeftActive] = useState(false);
  const [rightActive, setRightActive] = useState(false);
  const [topActive, setTopActive] = useState(false);
  const [leftMenu, setLeftMenu] = useState<LeftMenu>(null);
  const [hintsVisible, setHintsVisible] = useState(() => {
    try {
      return localStorage.getItem(HINT_KEY) !== '1';
    } catch {
      return true;
    }
  });

  const dismissHints = useCallback(() => {
    setHintsVisible(false);
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
      /* ignore */
    }
  }, []);

  const openLeftMenu = useCallback((menu: Exclude<LeftMenu, null>) => {
    setLeftMenu(menu);
  }, []);

  const closeLeftMenu = useCallback(() => {
    setLeftMenu(null);
  }, []);

  const toggleLeftMenu = useCallback((menu: Exclude<LeftMenu, null>) => {
    setLeftMenu((cur) => (cur === menu ? null : menu));
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      setLeftActive(false);
      setRightActive(false);
      setTopActive(false);
      return;
    }

    const onMove = (e: PointerEvent) => {
      const w = window.innerWidth;
      setLeftActive(e.clientX < 160);
      setRightActive(e.clientX > w - 180);
      setTopActive(e.clientY < 56);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [isDesktop]);

  // Click outside closes whichever left menu is open.
  useEffect(() => {
    if (!leftMenu) return;
    const onDown = () => setLeftMenu(null);
    const id = window.setTimeout(() => {
      window.addEventListener('pointerdown', onDown);
    }, 0);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [leftMenu]);

  const ghost = isDesktop ? 0.7 : 0.8;
  const full = 1;

  const value = useMemo<HudIntentValue>(
    () => ({
      isDesktop,
      leftActive,
      rightActive,
      topActive,
      hintsVisible,
      dismissHints,
      leftOpacity: isDesktop ? (leftActive || leftMenu ? full : ghost) : ghost,
      rightOpacity: isDesktop ? (rightActive ? full : ghost) : ghost,
      topOpacity: isDesktop ? (topActive ? 0.9 : 0.55) : 0.65,
      leftMenu,
      openLeftMenu,
      closeLeftMenu,
      toggleLeftMenu,
    }),
    [
      isDesktop,
      leftActive,
      rightActive,
      topActive,
      hintsVisible,
      dismissHints,
      leftMenu,
      openLeftMenu,
      closeLeftMenu,
      toggleLeftMenu,
      ghost,
    ],
  );

  return <HudIntentContext.Provider value={value}>{children}</HudIntentContext.Provider>;
}

export function useHudIntent(): HudIntentValue {
  const ctx = useContext(HudIntentContext);
  if (!ctx) throw new Error('useHudIntent must be used within HudIntentProvider');
  return ctx;
}
