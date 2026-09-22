/**
 * Proves a stored connection round-trips: the secret key decrypts back to what
 * was handed in, and the AAD binding actually binds — a ciphertext moved to
 * another column must fail to decrypt rather than silently succeed.
 */
import "dotenv/config";
import { db } from "../src/lib/db.ts";
import { aadFor, decryptSecret } from "../src/lib/crypto/envelope.ts";

const slug = process.argv[2];
if (!slug) { console.error("usage: verify-connection.mts <project-slug>"); process.exit(1); }

const project = await db.project.findUniqueOrThrow({
  where: { slug },
  include: { connection: true, scripts: { orderBy: { version: "desc" }, take: 1 } },
});
const c = project.connection!;

console.log(`project      ${project.name} (${project.slug})`);
console.log(`ref          ${c.projectRef}`);
console.log(`publishable  ${c.publishableKey ? "present (plaintext, public by design)" : "absent"}`);
console.log(`secret col   ${c.secretKeyEnc?.slice(0, 24)}…  <- ciphertext at rest`);

const secret = decryptSecret(c.secretKeyEnc!, aadFor(c.id, "secretKey"), c.keyVersion);
console.log(`decrypted    ${secret.slice(0, 11)}… (${secret.length} chars)`);
console.log(`matches env  ${secret === process.env.SUPABASE_SECRET_KEY}`);

try {
  decryptSecret(c.secretKeyEnc!, aadFor(c.id, "accessToken"), c.keyVersion);
  console.log("AAD binding  BROKEN — decrypted under the wrong field");
} catch {
  console.log("AAD binding  holds (wrong field refuses to decrypt)");
}
try {
  decryptSecret(c.secretKeyEnc!, aadFor("some-other-project", "secretKey"), c.keyVersion);
  console.log("AAD binding  BROKEN — decrypted under another connection id");
} catch {
  console.log("AAD binding  holds (wrong connection refuses to decrypt)");
}
console.log(`script       ${project.scripts[0].label} v${project.scripts[0].version}`);
await db.$disconnect();
