import { useExplorerStore } from '@/state/ExplorerStore';

/** Dedicated record control — separate from Express/Lab instrument rails. */
export function RecordButton() {
  const isRecording = useExplorerStore((s) => s.isRecording);
  const startRecording = useExplorerStore((s) => s.startRecording);
  const stopRecording = useExplorerStore((s) => s.stopRecording);
  const uiVisible = useExplorerStore((s) => s.uiVisible);

  if (!uiVisible && !isRecording) return null;

  return (
    <button
      type="button"
      onClick={() => (isRecording ? stopRecording() : startRecording())}
      className={`fixed z-[100] pointer-events-auto flex items-center gap-[8px] min-h-[40px] px-[14px] py-[8px] rounded-full cursor-pointer uppercase transition-all duration-200 ${
        isRecording
          ? 'border border-[rgba(255,60,60,0.5)] text-[rgba(255,120,120,0.95)] bg-[rgba(0,8,16,0.55)]'
          : 'hud-fractal-name border border-[rgba(0,255,65,0.22)]'
      }`}
      style={{
        bottom: 'calc(12px + var(--hud-safe-bottom))',
        left: '50%',
        transform: 'translateX(-50%)',
        backdropFilter: 'blur(8px)',
        fontSize: 11,
        letterSpacing: '0.12em',
      }}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      title="Records what you see in realtime as H.264 MP4"
    >
      <span
        className={`inline-block w-[8px] h-[8px] rounded-full ${
          isRecording ? 'bg-[rgba(255,50,50,0.95)] animate-pulse' : 'bg-[rgba(0,255,65,0.85)]'
        }`}
      />
      {isRecording ? 'Stop' : 'Record'}
    </button>
  );
}
