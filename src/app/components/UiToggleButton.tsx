import { useExplorerStore } from '@/state/ExplorerStore';

export function UiToggleButton() {
  const uiVisible = useExplorerStore((s) => s.uiVisible);
  const toggleUiVisible = useExplorerStore((s) => s.toggleUiVisible);

  return (
    <button
      onClick={toggleUiVisible}
      className="fixed z-[100] w-[36px] h-[36px] bg-transparent border border-[rgba(0,255,65,0.22)] rounded-full cursor-pointer flex items-center justify-center transition-all duration-200 hover:border-[rgba(0,255,65,0.5)] opacity-75 hover:opacity-100"
      style={{
        bottom: 'calc(12px + var(--hud-safe-bottom))',
        right: 'max(12px, var(--hud-safe-right))',
      }}
      aria-label={uiVisible ? 'Hide UI' : 'Show UI'}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M8 3C4.5 3 1.5 8 1.5 8s3 5 6.5 5 6.5-5 6.5-5-3-5-6.5-5z" stroke="rgba(0,255,65,0.65)" strokeWidth="1.2" fill="none" />
        <circle cx="8" cy="8" r="2" stroke="rgba(0,255,65,0.65)" strokeWidth="1.2" fill="none" />
        {!uiVisible && (
          <line x1="3" y1="3" x2="13" y2="13" stroke="rgba(0,255,65,0.65)" strokeWidth="1.2" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}
