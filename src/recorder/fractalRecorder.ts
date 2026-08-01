/**
 * Records the WebGL canvas as realtime H.264 MP4 (QuickTime-compatible).
 *
 * Primary path: canvas.captureStream → MediaStreamVideoTrackSource → AVC MP4.
 * That matches wall-clock duration and on-screen motion (WYSIWYG), unlike
 * manual CanvasSource frame pumping which either lagged or stretched.
 */

import {
  BufferTarget,
  Conversion,
  Input,
  ALL_FORMATS,
  BlobSource,
  MediaStreamVideoTrackSource,
  Mp4OutputFormat,
  Output,
  canEncodeVideo,
} from 'mediabunny';

export const RECORD_FPS = 30;

/** Soft cap so huge retina canvases still encode; keeps near-1080p quality. */
const ENCODE_MAX_EDGE = 1920;

/** Target bitrate for fractal detail (≈16 Mbps). */
const ENCODE_BITRATE = 16_000_000;

let canvasEl: HTMLCanvasElement | null = null;

type StreamSession = {
  mode: 'stream';
  output: Output;
  source: MediaStreamVideoTrackSource;
  target: BufferTarget;
  stream: MediaStream;
  startedAt: number;
};

type MediaRecorderSession = {
  mode: 'mediarecorder';
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  startedAt: number;
};

type Session = StreamSession | MediaRecorderSession;

let session: Session | null = null;

export function setRecordCanvas(canvas: HTMLCanvasElement | null): void {
  canvasEl = canvas;
}

export function getRecordCanvas(): HTMLCanvasElement | null {
  return canvasEl;
}

export function isRecorderActive(): boolean {
  return session !== null;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function evenSize(n: number): number {
  const v = Math.max(2, Math.floor(n));
  return v % 2 === 0 ? v : v - 1;
}

function exportSize(srcW: number, srcH: number): { width: number; height: number } {
  const w = Math.max(2, srcW);
  const h = Math.max(2, srcH);
  const scale = Math.min(1, ENCODE_MAX_EDGE / Math.max(w, h));
  return {
    width: evenSize(w * scale),
    height: evenSize(h * scale),
  };
}

async function canEncodeQuickTimeAvc(width: number, height: number): Promise<boolean> {
  try {
    return await canEncodeVideo('avc', {
      width,
      height,
      bitrate: ENCODE_BITRATE,
    });
  } catch {
    return false;
  }
}

function encodingConfig(width: number, height: number) {
  return {
    codec: 'avc' as const,
    bitrate: ENCODE_BITRATE,
    keyFrameInterval: 2,
    alpha: 'discard' as const,
    hardwareAcceleration: 'prefer-hardware' as const,
    latencyMode: 'realtime' as const,
    bitrateMode: 'variable' as const,
    transform: {
      width,
      height,
      fit: 'fill' as const,
      alpha: 'discard' as const,
    },
  };
}

export async function startCanvasRecording(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (session) return { ok: false, error: 'Already recording' };
  if (!canvasEl) return { ok: false, error: 'Canvas not ready' };
  if (typeof canvasEl.captureStream !== 'function') {
    return { ok: false, error: 'This browser cannot capture the canvas stream.' };
  }

  const srcW = canvasEl.width || canvasEl.clientWidth || 1280;
  const srcH = canvasEl.height || canvasEl.clientHeight || 720;
  const { width, height } = exportSize(srcW, srcH);
  const fps = RECORD_FPS;

  // Prefer direct realtime H.264 from the live canvas stream.
  if (await canEncodeQuickTimeAvc(width, height)) {
    try {
      const stream = canvasEl.captureStream(fps);
      const track = stream.getVideoTracks()[0];
      if (!track) throw new Error('No video track from canvas');

      const target = new BufferTarget();
      const output = new Output({
        format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
        target,
      });
      const source = new MediaStreamVideoTrackSource(track, encodingConfig(width, height), {
        frameRate: fps,
        timestampBase: 'zero',
      });
      output.addVideoTrack(source, { frameRate: fps });
      await output.start();

      // Surface encoder failures without waiting until stop.
      void source.errorPromise.catch((err) => {
        console.error('Stream encode error:', err);
      });

      session = {
        mode: 'stream',
        output,
        source,
        target,
        stream,
        startedAt: performance.now(),
      };
      console.info(`Recording: realtime ${width}×${height} @ ${fps}fps (canvas ${srcW}×${srcH})`);
      return { ok: true };
    } catch (err) {
      session = null;
      console.error('Realtime H.264 stream recording failed:', err);
      // fall through to MediaRecorder → transcode
    }
  }

  // Fallback: WebM via MediaRecorder, then transcode to H.264 MP4
  if (typeof MediaRecorder === 'undefined') {
    return {
      ok: false,
      error: 'This browser cannot encode H.264 MP4. Try Chrome or Safari.',
    };
  }

  const mimeCandidates = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  const mimeType = mimeCandidates.find((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType) {
    return {
      ok: false,
      error: 'This browser cannot encode H.264 MP4. Try Chrome or Safari.',
    };
  }

  if (!(await canEncodeQuickTimeAvc(width, height))) {
    return {
      ok: false,
      error: 'This browser cannot encode H.264 (needed for QuickTime). Try Chrome or Safari.',
    };
  }

  try {
    const stream = canvasEl.captureStream(fps);
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: ENCODE_BITRATE,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.start(250);
    session = {
      mode: 'mediarecorder',
      recorder,
      stream,
      chunks,
      startedAt: performance.now(),
    };
    return { ok: true };
  } catch (err) {
    session = null;
    const msg = err instanceof Error ? err.message : 'Failed to start recording';
    return { ok: false, error: msg };
  }
}

async function convertToQuickTimeMp4(webm: Blob, width: number, height: number): Promise<Blob> {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(webm),
  });
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  });
  const conversion = await Conversion.init({
    input,
    output,
    video: {
      codec: 'avc',
      bitrate: ENCODE_BITRATE,
      forceTranscode: true,
      alpha: 'discard',
      keyFrameInterval: 2,
      width,
      height,
      fit: 'fill',
    },
  });
  if (!conversion.isValid) {
    throw new Error('H.264 MP4 conversion not possible in this browser');
  }
  await conversion.execute();
  if (!target.buffer) throw new Error('Empty MP4 output');
  return new Blob([target.buffer], { type: 'video/mp4' });
}

export async function stopCanvasRecording(filenameBase: string): Promise<void> {
  const active = session;
  session = null;
  if (!active) return;

  const base = filenameBase.replace(/\.(webm|mp4)$/i, '');
  const wallSecs = (performance.now() - active.startedAt) / 1000;

  try {
    if (active.mode === 'stream') {
      active.source.close();
      for (const track of active.stream.getTracks()) track.stop();
      await active.output.finalize();
      const buffer = active.target.buffer;
      if (!buffer || buffer.byteLength === 0) {
        throw new Error('Empty recording');
      }
      console.info(`Recording finished: ~${wallSecs.toFixed(1)}s wall time, ${(buffer.byteLength / 1e6).toFixed(1)} MB`);
      downloadBlob(new Blob([buffer], { type: 'video/mp4' }), `${base}.mp4`);
      return;
    }

    const webm = await new Promise<Blob>((resolve, reject) => {
      active.recorder.onstop = () => {
        resolve(new Blob(active.chunks, { type: active.recorder.mimeType || 'video/webm' }));
      };
      active.recorder.onerror = () => reject(new Error('MediaRecorder error'));
      if (active.recorder.state === 'inactive') {
        resolve(new Blob(active.chunks, { type: 'video/webm' }));
      } else {
        active.recorder.stop();
      }
    });
    for (const track of active.stream.getTracks()) track.stop();

    if (webm.size === 0) throw new Error('Empty recording');

    const srcW = canvasEl?.width || 1280;
    const srcH = canvasEl?.height || 720;
    const { width, height } = exportSize(srcW, srcH);
    const mp4 = await convertToQuickTimeMp4(webm, width, height);
    console.info(`Recording finished (transcoded): ~${wallSecs.toFixed(1)}s wall time`);
    downloadBlob(mp4, `${base}.mp4`);
  } catch (err) {
    console.error('MP4 export failed:', err);
    const detail = err instanceof Error ? err.message : String(err);
    alert(`Could not create the MP4 recording (${detail}). Try Chrome or Safari, then record again.`);
    throw err;
  }
}
