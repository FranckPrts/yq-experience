import "server-only";
import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing — argon2id, the memory-hard default.
 *
 * Parameters follow OWASP's current floor (19 MiB, 2 passes, 1 lane). They are
 * written down rather than left implicit because a future bump has to be a
 * deliberate decision: raising them invalidates nothing (each hash records the
 * parameters it was made with) but does change the cost of every sign-in.
 */
const OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

/**
 * Verify never throws on a malformed or foreign hash — it returns false. The
 * placeholder scrypt hashes written by the seeding CLI before this module
 * existed land here, and must read as "wrong password" rather than crash the
 * sign-in route.
 */
export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}

/** Minimum viable policy. Length is the part that actually matters. */
export function passwordProblem(password: string): string | null {
  if (password.length < 9) return "Use at least 9 characters.";
  if (password.length > 200) return "That is longer than 200 characters.";
  return null;
}
