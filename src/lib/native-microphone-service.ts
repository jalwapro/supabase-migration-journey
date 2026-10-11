import { Capacitor, registerPlugin } from "@capacitor/core";

type MicrophoneForegroundServicePlugin = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

const NativeMicrophoneService = registerPlugin<MicrophoneForegroundServicePlugin>(
  "MicrophoneForegroundService",
);

export async function startNativeMicrophoneForegroundService() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
  await NativeMicrophoneService.start();
}

export async function stopNativeMicrophoneForegroundService() {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
  await NativeMicrophoneService.stop();
}
