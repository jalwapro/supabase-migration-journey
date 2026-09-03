import { AccessToken } from "livekit-server-sdk";

export async function createLiveKitToken(args: {
  identity: string;
  name?: string;
  room: string;
  canPublish: boolean;
}) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) throw new Error("LiveKit server credentials are not configured");

  const token = new AccessToken(apiKey, apiSecret, {
    identity: args.identity,
    name: args.name ?? args.identity,
    ttl: "1h",
  });

  token.addGrant({
    roomJoin: true,
    room: args.room,
    canSubscribe: true,
    canPublish: args.canPublish,
    canPublishData: true,
  });

  return token.toJwt();
}
