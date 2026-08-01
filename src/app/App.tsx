import { FractalCanvas } from './components/FractalCanvas';
import { HudOverlay } from './components/HudOverlay';
import { RecordButton } from './components/RecordButton';
import { ScanlineOverlay } from './components/ScanlineOverlay';
import { UiToggleButton } from './components/UiToggleButton';
import { useExplorerStore } from '@/state/ExplorerStore';

export default function App() {
  const isRecording = useExplorerStore((s) => s.isRecording);

  return (
    <div
      className="fixed inset-0 bg-[#000408] overflow-hidden"
      style={{ fontFamily: "'Share Tech Mono', monospace" }}
    >
      <FractalCanvas />
      {!isRecording && <ScanlineOverlay />}
      {!isRecording && <HudOverlay />}
      {!isRecording && <UiToggleButton />}
      <RecordButton />
    </div>
  );
}
