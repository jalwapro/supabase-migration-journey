/**
 * MediaPipe singleton loaders. WASM models fetched lazily from Google CDN
 * on first camera-on. Cached for entire session.
 */
import type { FaceLandmarker, ImageSegmenter } from "@mediapipe/tasks-vision";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

function pickDelegate(): "GPU" | "CPU" {
  // Android WebView / some mobile GPUs often fail MediaPipe GPU delegate
  // silently. CPU is slower but reliable, and keeps filters working instead
  // of disabling the whole pipeline.
  if (typeof navigator === "undefined") return "GPU";
  const ua = navigator.userAgent.toLowerCase();
  return /android|wv\)|iphone|ipad|ipod/.test(ua) ? "CPU" : "GPU";
}

let visionResolverPromise: Promise<{
  FaceLandmarker: typeof FaceLandmarker;
  ImageSegmenter: typeof ImageSegmenter;
  FilesetResolver: typeof import("@mediapipe/tasks-vision").FilesetResolver;
}> | null = null;
async function getVision() {
  if (!visionResolverPromise) {
    visionResolverPromise = import("@mediapipe/tasks-vision").then((m) => ({
      FaceLandmarker: m.FaceLandmarker,
      ImageSegmenter: m.ImageSegmenter,
      FilesetResolver: m.FilesetResolver,
    }));
  }
  return visionResolverPromise;
}

let faceLandmarkerPromise: Promise<FaceLandmarker> | null = null;
export function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!faceLandmarkerPromise) {
    faceLandmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await getVision();
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      return FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: pickDelegate(),
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });
    })().catch((e) => {
      faceLandmarkerPromise = null;
      throw e;
    });
  }
  return faceLandmarkerPromise;
}

let segmenterPromise: Promise<ImageSegmenter> | null = null;
export function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { ImageSegmenter, FilesetResolver } = await getVision();
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite",
          delegate: pickDelegate(),
        },
        runningMode: "VIDEO",
        outputCategoryMask: true,
        outputConfidenceMasks: false,
      });
    })().catch((e) => {
      segmenterPromise = null;
      throw e;
    });
  }
  return segmenterPromise;
}
