/**
 * GiftGLVideo — GPU (WebGL) gift clip renderer.
 *
 * Runs the whole admin-configured pipeline in a single fragment shader:
 * crop → chroma key (green/blue/black/white) → spill suppression →
 * colour recovery → colour correction → sharpen/denoise → masked edge blur.
 *
 * Colour fidelity is the hard requirement: every grade defaults to neutral,
 * spill suppression is weighted by how "key coloured" a pixel actually is, and
 * colour recovery blends the original pixel back in, so blacks stay black,
 * reds stay red and gold stays gold. Nothing is brightened implicitly.
 *
 * If WebGL or a cross-origin texture upload is unavailable it transparently
 * falls back to a plain <video> with the equivalent CSS filter chain.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { hexToRgb, type GiftRenderConfig } from "@/lib/giftRender";

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2((aPos.x + 1.0) * 0.5, 1.0 - (aPos.y + 1.0) * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform vec4 uCrop;        // left, top, right, bottom (uv fractions)
uniform vec3 uKey;
uniform float uMode;       // 0 off | 1 colour | 2 black | 3 white
uniform float uTol, uSoft, uSpill, uShadowProt, uColorRec, uContrastRec, uEdgeClean;
uniform float uBright, uContrast, uSat, uTemp, uTint, uHigh, uShadowAdj, uExposure, uGamma, uHue;
uniform float uSharp, uDenoise;
uniform vec4 uBlurEdges;   // top, bottom, left, right (0..1)
uniform float uBlurRadius, uFeather, uOpacity;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec2 chroma(vec3 c) {
  return vec2(
    -0.168736 * c.r - 0.331264 * c.g + 0.5 * c.b,
     0.5 * c.r - 0.418688 * c.g - 0.081312 * c.b
  );
}

vec3 hueRotate(vec3 c, float deg) {
  float a = radians(deg);
  float s = sin(a), co = cos(a);
  mat3 m = mat3(
    0.213 + co * 0.787 - s * 0.213, 0.213 - co * 0.213 + s * 0.143, 0.213 - co * 0.213 - s * 0.787,
    0.715 - co * 0.715 - s * 0.715, 0.715 + co * 0.285 + s * 0.140, 0.715 - co * 0.715 + s * 0.715,
    0.072 - co * 0.072 + s * 0.928, 0.072 - co * 0.072 - s * 0.283, 0.072 + co * 0.928 + s * 0.072
  );
  return m * c;
}

vec2 srcUv(vec2 uv) {
  return vec2(mix(uCrop.x, 1.0 - uCrop.z, uv.x), mix(uCrop.y, 1.0 - uCrop.w, uv.y));
}

vec3 samp(vec2 uv) { return texture2D(uTex, srcUv(uv)).rgb; }

void main() {
  vec2 uv = vUv;
  vec3 orig = samp(uv);
  vec3 c = orig;

  // --- denoise (light 3x3 box mix) ---
  if (uDenoise > 0.001) {
    vec3 sum = vec3(0.0);
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        sum += samp(uv + vec2(float(x), float(y)) * uTexel);
      }
    }
    c = mix(c, sum / 9.0, uDenoise);
  }

  // --- sharpen (unsharp mask) ---
  if (uSharp > 0.001) {
    vec3 blur = (
      samp(uv + vec2(uTexel.x, 0.0)) + samp(uv - vec2(uTexel.x, 0.0)) +
      samp(uv + vec2(0.0, uTexel.y)) + samp(uv - vec2(0.0, uTexel.y))
    ) * 0.25;
    c = clamp(c + (c - blur) * uSharp * 2.0, 0.0, 1.0);
  }

  float luma = dot(c, LUMA);
  float alpha = 1.0;
  float keyness = 0.0;

  if (uMode > 0.5 && uMode < 1.5) {
    vec2 kc = chroma(uKey);
    float dist = distance(chroma(c), kc);
    float tol = uTol * 0.5;
    float soft = max(uSoft * 0.5, 0.0015);
    alpha = smoothstep(tol, tol + soft, dist);
    keyness = 1.0 - alpha;
    // shadow protection: dark subject pixels must never be keyed away
    if (uShadowProt > 0.001 && luma < uShadowProt) alpha = 1.0;
  } else if (uMode > 1.5 && uMode < 2.5) {
    alpha = smoothstep(uTol * 0.5, uTol * 0.5 + max(uSoft * 0.5, 0.0015), luma);
  } else if (uMode > 2.5) {
    alpha = smoothstep(uTol * 0.5, uTol * 0.5 + max(uSoft * 0.5, 0.0015), 1.0 - luma);
  }

  // --- edge cleanup (alpha choke, kills key-coloured fringes/halos) ---
  if (uEdgeClean > 0.001) {
    alpha = clamp((alpha - uEdgeClean) / max(1.0 - uEdgeClean, 0.001), 0.0, 1.0);
  }

  // --- spill suppression, weighted by how key-coloured the pixel is ---
  if (uMode > 0.5 && uMode < 1.5 && uSpill > 0.001) {
    vec3 inv = 1.0 - uKey;
    float other = dot(c, inv) / max(dot(vec3(1.0), inv), 0.001);
    float kAmt = dot(c, uKey) / max(dot(uKey, uKey), 0.001);
    float excess = max(0.0, kAmt - other);
    vec3 suppressed = c - uKey * excess * uSpill;
    // only touch pixels that actually carry spill; everything else stays exact
    float w = clamp(excess * 3.0, 0.0, 1.0);
    c = mix(c, clamp(suppressed, 0.0, 1.0), w);
    // colour recovery: blend the untouched original back in
    c = mix(c, orig, uColorRec * (1.0 - keyness) * (1.0 - w * 0.5));
  }

  // --- contrast recovery (counters keyed-edge wash-out) ---
  if (uContrastRec > 0.001) {
    c = clamp(mix(c, (c - 0.5) * (1.0 + uContrastRec) + 0.5, 1.0), 0.0, 1.0);
  }

  // --- colour correction (all neutral by default) ---
  if (abs(uExposure) > 0.001) c *= pow(2.0, uExposure);
  if (abs(uBright) > 0.001) c += uBright;
  if (abs(uContrast) > 0.001) c = (c - 0.5) * (1.0 + uContrast) + 0.5;
  if (abs(uTemp) > 0.001) { c.r += uTemp * 0.15; c.b -= uTemp * 0.15; }
  if (abs(uTint) > 0.001) { c.g += uTint * 0.15; }
  if (abs(uHigh) > 0.001) {
    float m = smoothstep(0.5, 1.0, dot(c, LUMA));
    c += uHigh * m * 0.5;
  }
  if (abs(uShadowAdj) > 0.001) {
    float m = 1.0 - smoothstep(0.0, 0.5, dot(c, LUMA));
    c += uShadowAdj * m * 0.5;
  }
  c = clamp(c, 0.0, 1.0);
  if (abs(uGamma - 1.0) > 0.001) c = pow(c, vec3(1.0 / max(uGamma, 0.05)));
  if (abs(uSat - 1.0) > 0.001) c = mix(vec3(dot(c, LUMA)), c, uSat);
  if (abs(uHue) > 0.001) c = clamp(hueRotate(c, uHue), 0.0, 1.0);

  // --- masked edge blur ---
  if (uBlurRadius > 0.0001) {
    float feather = max(uFeather, 0.001);
    float w = 0.0;
    if (uBlurEdges.x > 0.0) w = max(w, 1.0 - smoothstep(max(uBlurEdges.x - feather, 0.0), uBlurEdges.x, uv.y));
    if (uBlurEdges.y > 0.0) w = max(w, smoothstep(1.0 - uBlurEdges.y, min(1.0 - uBlurEdges.y + feather, 1.0), uv.y));
    if (uBlurEdges.z > 0.0) w = max(w, 1.0 - smoothstep(max(uBlurEdges.z - feather, 0.0), uBlurEdges.z, uv.x));
    if (uBlurEdges.w > 0.0) w = max(w, smoothstep(1.0 - uBlurEdges.w, min(1.0 - uBlurEdges.w + feather, 1.0), uv.x));
    if (w > 0.001) {
      vec3 sum = vec3(0.0);
      for (int y = -2; y <= 2; y++) {
        for (int x = -2; x <= 2; x++) {
          sum += samp(uv + vec2(float(x), float(y)) * uTexel * uBlurRadius);
        }
      }
      c = mix(c, sum / 25.0, w);
    }
  }

  gl_FragColor = vec4(c * alpha, alpha * uOpacity);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.error("[GiftGL] shader error", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function chromaModeValue(cfg: GiftRenderConfig, detected: "green" | "black" | "none" | null): number {
  let mode = cfg.chromaMode;
  if (mode === "auto") {
    mode = detected === "green" ? "green" : detected === "black" ? "black" : "off";
  }
  if (mode === "green" || mode === "blue") return 1;
  if (mode === "black") return 2;
  if (mode === "white") return 3;
  return 0;
}

function keyColorFor(cfg: GiftRenderConfig): [number, number, number] {
  if (cfg.chromaMode === "blue") return [0, 0, 1];
  if (cfg.chromaMode === "green") return [0, 1, 0];
  return hexToRgb(cfg.keyColor);
}

export interface GiftGLVideoProps {
  src: string;
  config: GiftRenderConfig;
  muted?: boolean;
  volume?: number;
  loop?: boolean;
  className?: string;
  style?: React.CSSProperties;
  objectFit?: React.CSSProperties["objectFit"];
  onReady?: () => void;
  onEnded?: () => void;
  onError?: () => void;
  onDuration?: (ms: number) => void;
  playbackKey?: string;
}

export function GiftGLVideo({
  src,
  config,
  muted = true,
  volume = 1,
  loop = false,
  className,
  style,
  objectFit = "contain",
  onReady,
  onEnded,
  onError,
  onDuration,
  playbackKey,
}: GiftGLVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cfgRef = useRef(config);
  cfgRef.current = config;
  const detectedRef = useRef<"green" | "black" | "none" | null>(null);
  const [glFailed, setGlFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const readyOnce = useRef(false);

  const markReady = useCallback(() => {
    setReady(true);
    if (!readyOnce.current) {
      readyOnce.current = true;
      onReady?.();
    }
  }, [onReady]);

  useEffect(() => {
    readyOnce.current = false;
    setReady(false);
    detectedRef.current = null;
  }, [src]);

  // Auto-detect the backdrop once from the first frame (border sampling).
  const detect = useCallback((video: HTMLVideoElement) => {
    if (detectedRef.current || !video.videoWidth) return;
    try {
      const w = 32;
      const h = Math.max(8, Math.round((video.videoHeight / video.videoWidth) * w));
      const cv = document.createElement("canvas");
      cv.width = w;
      cv.height = h;
      const ctx = cv.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const d = ctx.getImageData(0, 0, w, h).data;
      let green = 0;
      let dark = 0;
      let n = 0;
      const push = (x: number, y: number) => {
        const i = (y * w + x) * 4;
        const r = d[i]!, g = d[i + 1]!, b = d[i + 2]!, a = d[i + 3]!;
        if (a < 24) return;
        n += 1;
        if (g > 70 && g > r * 1.35 && g > b * 1.35) green += 1;
        else if (r + g + b < 96) dark += 1;
      };
      for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
      for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
      detectedRef.current = n === 0 ? "none" : green / n > 0.3 ? "green" : dark / n > 0.5 ? "black" : "none";
    } catch {
      detectedRef.current = "none";
    }
  }, []);

  useEffect(() => {
    if (glFailed) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const gl = canvas.getContext("webgl", {
      premultipliedAlpha: true,
      alpha: true,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) { setGlFailed(true); return; }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { setGlFailed(true); return; }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { setGlFailed(true); return; }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const U = (n: string) => gl.getUniformLocation(prog, n);
    const u = {
      texel: U("uTexel"), crop: U("uCrop"), key: U("uKey"), mode: U("uMode"),
      tol: U("uTol"), soft: U("uSoft"), spill: U("uSpill"), shadowProt: U("uShadowProt"),
      colorRec: U("uColorRec"), contrastRec: U("uContrastRec"), edgeClean: U("uEdgeClean"),
      bright: U("uBright"), contrast: U("uContrast"), sat: U("uSat"), temp: U("uTemp"),
      tint: U("uTint"), high: U("uHigh"), shadowAdj: U("uShadowAdj"), exposure: U("uExposure"),
      gamma: U("uGamma"), hue: U("uHue"), sharp: U("uSharp"), denoise: U("uDenoise"),
      blurEdges: U("uBlurEdges"), blurRadius: U("uBlurRadius"), feather: U("uFeather"),
      opacity: U("uOpacity"),
    };

    let raf = 0;
    let disposed = false;
    let lastW = 0;
    let lastH = 0;

    const frame = () => {
      if (disposed) return;
      raf = requestAnimationFrame(frame);
      const v = videoRef.current;
      if (!v || v.readyState < 2 || !v.videoWidth) return;
      detect(v);
      const cfg = cfgRef.current;

      const cw = Math.max(1, Math.round(v.videoWidth * (1 - cfg.cropLeft / v.videoWidth - cfg.cropRight / v.videoWidth)));
      const ch = Math.max(1, Math.round(v.videoHeight * (1 - cfg.cropTop / v.videoHeight - cfg.cropBottom / v.videoHeight)));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      if (lastW !== canvas.width || lastH !== canvas.height) {
        lastW = canvas.width;
        lastH = canvas.height;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      try {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
      } catch {
        disposed = true;
        cancelAnimationFrame(raf);
        setGlFailed(true);
        return;
      }

      gl.uniform2f(u.texel, 1 / v.videoWidth, 1 / v.videoHeight);
      gl.uniform4f(
        u.crop,
        cfg.cropLeft / v.videoWidth,
        cfg.cropTop / v.videoHeight,
        cfg.cropRight / v.videoWidth,
        cfg.cropBottom / v.videoHeight,
      );
      const key = keyColorFor(cfg);
      gl.uniform3f(u.key, key[0], key[1], key[2]);
      gl.uniform1f(u.mode, chromaModeValue(cfg, detectedRef.current));
      gl.uniform1f(u.tol, cfg.greenTolerance / 100);
      gl.uniform1f(u.soft, cfg.edgeSoftness / 100);
      gl.uniform1f(u.spill, cfg.spillSuppression / 100);
      gl.uniform1f(u.shadowProt, cfg.shadowProtection / 100 * 0.35);
      gl.uniform1f(u.colorRec, cfg.colorRecovery / 100);
      gl.uniform1f(u.contrastRec, cfg.contrastRecovery / 100);
      gl.uniform1f(u.edgeClean, cfg.edgeCleanup / 100 * 0.5);
      gl.uniform1f(u.bright, cfg.brightness / 100);
      gl.uniform1f(u.contrast, cfg.contrast / 100);
      gl.uniform1f(u.sat, cfg.saturation);
      gl.uniform1f(u.temp, cfg.temperature / 100);
      gl.uniform1f(u.tint, cfg.tint / 100);
      gl.uniform1f(u.high, cfg.highlights / 100);
      gl.uniform1f(u.shadowAdj, cfg.shadows / 100);
      gl.uniform1f(u.exposure, cfg.exposure / 100);
      gl.uniform1f(u.gamma, cfg.gamma);
      gl.uniform1f(u.hue, cfg.hue);
      gl.uniform1f(u.sharp, cfg.sharpness / 100);
      gl.uniform1f(u.denoise, cfg.denoise / 100);
      gl.uniform4f(u.blurEdges, cfg.blurTop / 100, cfg.blurBottom / 100, cfg.blurLeft / 100, cfg.blurRight / 100);
      gl.uniform1f(u.blurRadius, cfg.blurRadius / 100 * 12);
      gl.uniform1f(u.feather, Math.max(cfg.blurFeather / 100, 0.01));
      gl.uniform1f(u.opacity, 1);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      gl.deleteTexture(tex);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [glFailed, detect, src]);

  // Keep audio in sync with props.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    v.volume = Math.max(0, Math.min(1, volume));
  }, [muted, volume]);

  const startPlayback = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    v.volume = Math.max(0, Math.min(1, volume));
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => {});
    });
  }, [muted, volume]);

  const cssFilter = (() => {
    const cfg = config;
    const parts: string[] = [];
    if (cfg.brightness) parts.push(`brightness(${1 + cfg.brightness / 100})`);
    if (cfg.contrast) parts.push(`contrast(${1 + cfg.contrast / 100})`);
    if (cfg.saturation !== 1) parts.push(`saturate(${cfg.saturation})`);
    if (cfg.hue) parts.push(`hue-rotate(${cfg.hue}deg)`);
    return parts.join(" ") || undefined;
  })();

  const mode = chromaModeValue(config, detectedRef.current);

  return (
    <>
      <video
        key={playbackKey || src}
        ref={videoRef}
        src={src}
        crossOrigin={glFailed ? undefined : "anonymous"}
        playsInline
        autoPlay
        loop={loop}
        muted={muted}
        preload="auto"
        disablePictureInPicture
        onLoadedData={startPlayback}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (onDuration && isFinite(d) && d > 0) onDuration(Math.ceil(d * 1000));
        }}
        onCanPlay={startPlayback}
        onPlaying={markReady}
        onEnded={() => onEnded?.()}
        onError={() => {
          if (!glFailed) setGlFailed(true); // retry without CORS, CSS path
          else onError?.();
        }}
        className={glFailed ? className : "sr-only"}
        style={
          glFailed
            ? {
                ...style,
                objectFit,
                filter: cssFilter,
                mixBlendMode: mode === 2 ? "screen" : undefined,
                opacity: ready ? 1 : 0,
                transition: "opacity 240ms ease-out",
              }
            : { position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }
        }
      />
      {!glFailed && (
        <canvas
          ref={canvasRef}
          className={className}
          style={{
            ...style,
            objectFit,
            opacity: ready ? 1 : 0,
            transition: "opacity 240ms ease-out",
            willChange: "opacity",
          }}
        />
      )}
    </>
  );
}

export default GiftGLVideo;
