// Server-only ZEGOCLOUD token04 generator.
// Direct port of ZEGOCLOUD's official reference implementation
// (github.com/ZEGOCLOUD/zego_server_assistant, token/nodejs/server/zegoServerAssistant.ts).
// Loaded only inside a server route handler.
import { createCipheriv, randomBytes } from "crypto";

function makeNonce(): number {
  // int32 range
  const buf = randomBytes(4);
  return buf.readInt32BE(0);
}

function aesGcmEncrypt(plainText: string, key: string): { encrypted: Buffer; nonce: Buffer } {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "utf8"), nonce);
  cipher.setAutoPadding(true);
  const body = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  return { encrypted: Buffer.concat([body, cipher.getAuthTag()]), nonce };
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
  const { encrypted, nonce } = aesGcmEncrypt(plaintText, serverSecret);

  // Official token04 binary layout:
  // expire(8, BE) | nonceLen(2, BE) | nonce | encLen(2, BE) | enc+tag | mode(1 = GCM)
  const b1 = Buffer.alloc(8);
  b1.writeBigInt64BE(BigInt(expire), 0);
  const b2 = Buffer.alloc(2);
  b2.writeUInt16BE(nonce.byteLength, 0);
  const b3 = Buffer.alloc(2);
  b3.writeUInt16BE(encrypted.byteLength, 0);
  const b4 = Buffer.from([1]);

  const buf = Buffer.concat([b1, b2, nonce, b3, encrypted, b4]);
  return { token: "04" + buf.toString("base64"), expire };
}
