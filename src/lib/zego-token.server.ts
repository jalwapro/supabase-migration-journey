// Server-only ZEGOCLOUD token04 generator.
// Direct port of ZEGOCLOUD's official reference implementation
// (github.com/ZEGOCLOUD/zego_server_assistant, token/nodejs/server/zegoServerAssistant.ts).
// Loaded only inside a server route handler.
import { createCipheriv, randomBytes } from "crypto";

const IV_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz";

function makeRandomIv(): string {
  const bytes = randomBytes(16);
  let out = "";
  for (let i = 0; i < 16; i++) out += IV_CHARS.charAt(bytes[i] % IV_CHARS.length);
  return out;
}

function makeNonce(): number {
  // int32 range
  const buf = randomBytes(4);
  return buf.readInt32BE(0);
}

function algorithmFor(secret: string): string {
  switch (Buffer.byteLength(secret)) {
    case 16: return "aes-128-cbc";
    case 24: return "aes-192-cbc";
    case 32: return "aes-256-cbc";
    default: throw new Error("ZEGO server secret must be 16/24/32 bytes");
  }
}

function aesEncrypt(plainText: string, key: string, iv: string): Buffer {
  const cipher = createCipheriv(algorithmFor(key), key, iv);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
}

export type ZegoPrivileges = { login?: boolean; publish?: boolean };

export function generateZegoToken04(
  appId: number,
  userId: string,
  serverSecret: string,
  effectiveTimeInSeconds: number,
  roomId: string,
  privileges: ZegoPrivileges = { login: true, publish: false },
): { token: string; expire: number } {
  if (!appId || typeof appId !== "number") throw new Error("appId invalid");
  if (!userId) throw new Error("userId invalid");
  if (!serverSecret || serverSecret.length !== 32) {
    throw new Error("ZEGO_SERVER_SECRET must be exactly 32 characters");
  }
  if (!effectiveTimeInSeconds || effectiveTimeInSeconds <= 0) {
    throw new Error("effectiveTimeInSeconds invalid");
  }

  const ctime = Math.floor(Date.now() / 1000);
  const expire = ctime + effectiveTimeInSeconds;

  const payloadObj = {
    room_id: roomId,
    // 1 = login, 2 = publish stream
    privilege: {
      1: privileges.login ? 1 : 0,
      2: privileges.publish ? 1 : 0,
    },
    stream_id_list: null,
  };

  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: makeNonce(),
    ctime,
    expire,
    payload: JSON.stringify(payloadObj),
  };

  const plaintText = JSON.stringify(tokenInfo);
  const iv = makeRandomIv();
  const encrypted = aesEncrypt(plaintText, serverSecret, iv);

  // Binary layout: expire(8, BE) | ivLen(2, BE) | iv | encLen(2, BE) | enc
  const b1 = Buffer.alloc(8);
  b1.writeBigInt64BE(BigInt(expire), 0);
  const b2 = Buffer.alloc(2);
  b2.writeUInt16BE(iv.length, 0);
  const b3 = Buffer.alloc(2);
  b3.writeUInt16BE(encrypted.byteLength, 0);

  const buf = Buffer.concat([b1, b2, Buffer.from(iv, "utf8"), b3, encrypted]);
  return { token: "04" + buf.toString("base64"), expire };
}
