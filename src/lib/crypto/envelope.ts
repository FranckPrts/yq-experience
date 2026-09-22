import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Application-level envelope encryption for tenant credentials.
 *
 * Bare Postgres gives us no Vault and no `pgsodium`, so PRD §3.3's mechanism is
 * unavailable. This is the stated deviation: AES-256-GCM with a master key from
 * the environment, decrypted only in this process at the moment a Supabase
 * client is instantiated.
 *
 * Stored form is `v1:<iv>:<tag>:<ciphertext>`, each part base64. The `v1` is the
 * *envelope format*; which master key was used is recorded separately, in the
 * row's `keyVersion`, so a rotation can decrypt old rows while writing new ones.
 *
 * Every value is bound to its purpose through GCM's additional authenticated
 * data — see `aadFor`. Without it a ciphertext could be lifted from one row or
 * column and pasted into another, and the decryption would happily succeed.
 */

const FORMAT = "v1";
const IV_BYTES = 12; // 96-bit nonce, the size GCM is defined for
const KEY_BYTES = 32; // AES-256

export const CURRENT_KEY_VERSION = 1;

/**
 * Binds a ciphertext to the exact place it belongs. A secret key encrypted for
 * project A cannot be moved to project B, nor into a different column, without
 * decryption failing.
 */
export function aadFor(
  connectionId: string,
  field: "accessToken" | "refreshToken" | "secretKey",
): Buffer {
  return Buffer.from(`${FORMAT}|${connectionId}|${field}`, "utf8");
}

function keyFor(version: number): Buffer {
  const name =
    version === CURRENT_KEY_VERSION
      ? "APP_MASTER_KEY"
      : `APP_MASTER_KEY_V${version}`;
  const raw = process.env[name];
  if (!raw) {
    throw new Error(
      `${name} is not set — generate one with: openssl rand -base64 32`,
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `${name} must decode to ${KEY_BYTES} bytes, got ${key.length}`,
    );
  }
  return key;
}

export function encryptSecret(
  plaintext: string,
  aad: Buffer,
  keyVersion: number = CURRENT_KEY_VERSION,
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", keyFor(keyVersion), iv);
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    FORMAT,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptSecret(
  envelope: string,
  aad: Buffer,
  keyVersion: number = CURRENT_KEY_VERSION,
): string {
  const parts = envelope.split(":");
  if (parts.length !== 4 || parts[0] !== FORMAT) {
    throw new Error("Malformed envelope");
  }

  const [, ivB64, tagB64, ciphertextB64] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    keyFor(keyVersion),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  // Throws if the tag does not verify — i.e. if the ciphertext, the AAD or the
  // key is wrong. A failure here is tampering or misconfiguration, never noise.
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Constant-time compare, for the session-token lookups Phase 1 still needs. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
