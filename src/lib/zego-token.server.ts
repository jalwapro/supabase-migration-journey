// Server-only ZEGOCLOUD token04 generator.
// Direct port of ZEGOCLOUD's official Node reference implementation.
// Loaded only inside a server route handler.
import { createCipheriv, randomBytes } from "crypto";

function makeNonce(): number {
  // int32 range
  const buf = randomBytes(4);
  return buf.readInt32BE(0);
}

function aesCbcEncrypt(plainText: string, key: string, iv: Buffer): Buffer {
  const cipher = createCipheriv("aes-256-cbc", Buffer.from(key, "utf8"), iv);
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

  const plainText = JSON.stringify(tokenInfo);
  const iv = randomBytes(16);
  const encrypted = aesCbcEncrypt(plainText, serverSecret, iv);

  // Official token04 binary layout:
  // expire(8, BE) | ivLen(2, BE) | iv | encLen(2, BE) | encryptedPayload
  const b1 = Buffer.alloc(8);
  b1.writeBigInt64BE(BigInt(expire), 0);
  const b2 = Buffer.alloc(2);
  b2.writeUInt16BE(iv.byteLength, 0);
  const b3 = Buffer.alloc(2);
  b3.writeUInt16BE(encrypted.byteLength, 0);

  const buf = Buffer.concat([b1, b2, iv, b3, encrypted]);
  return { token: "04" + buf.toString("base64"), expire };
}
