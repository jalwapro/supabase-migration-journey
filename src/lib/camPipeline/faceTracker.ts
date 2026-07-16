/**
 * FaceTracker — thin wrapper over MediaPipe FaceLandmarker.
 * VIDEO mode for live camera pipeline; IMAGE mode (via detectStatic) for
 * the /ar-test static harness.
 *
 * update() throttles inference to every other frame (~15Hz at 30fps) and
 * returns the last-known pose between inferences to keep overlays stable.
 */

import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { getFaceLandmarker } from "./mediapipe";
import type { FacePose } from "./arOverlays";

export class FaceTracker {
  private lm: FaceLandmarker | null = null;
  private ready = false;
  private frameParity = 0;
  private lastPose: FacePose | null = null;
  private disposed = false;

  async init(): Promise<void> {
    if (this.ready || this.disposed) return;
    this.lm = await getFaceLandmarker();
    this.ready = true;
  }

  /** Call once per animation frame with the source <video>. */
  update(video: HTMLVideoElement, tsMs: number): FacePose | null {
    if (!this.ready || !this.lm || this.disposed) return this.lastPose;
    if (video.readyState < 2) return this.lastPose;
    this.frameParity = (this.frameParity + 1) & 1;
    if (this.frameParity !== 0) return this.lastPose;
    try {
      const res: FaceLandmarkerResult = this.lm.detectForVideo(video, tsMs);
      const face = res.faceLandmarks?.[0];
      if (face && face.length >= 468) {
        this.lastPose = { landmarks: face };
      }
    } catch {
      // swallow — surface via caller's error throttle
    }
    return this.lastPose;
  }

  dispose(): void {
    this.disposed = true;
    this.lastPose = null;
    // shared singleton — do NOT close the landmarker itself.
    this.lm = null;
    this.ready = false;
  }
}

/**
 * Static-image detection for the /ar-test harness.
 * Creates a one-shot IMAGE-mode landmarker (separate from the VIDEO
 * singleton, since MediaPipe cannot swap runningMode on an existing task).
 */
let imageLmPromise: Promise<FaceLandmarker> | null = null;
async function getImageLandmarker(): Promise<FaceLandmarker> {
  if (imageLmPromise) return imageLmPromise;
  imageLmPromise = (async () => {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
    );
    return FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "CPU",
      },
      runningMode: "IMAGE",
      numFaces: 1,
    });
  })().catch((e) => {
    imageLmPromise = null;
    throw e;
  });
  return imageLmPromise;
}

export async function detectStatic(img: HTMLImageElement): Promise<FacePose | null> {
  const lm = await getImageLandmarker();
  const res = lm.detect(img);
  const face = res.faceLandmarks?.[0];
  if (!face || face.length < 468) return null;
  return { landmarks: face };
}
