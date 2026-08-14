/**
 * Encryption Key Rotation Script
 *
 * Re-encrypts all OrganizationApiKey rows from an old key to the current ENCRYPTION_KEY.
 *
 * Usage:
 *   OLD_ENCRYPTION_KEY=<old-hex-key> npx ts-node scripts/rotate-encryption-key.ts [--dry-run]
 *
 * Prerequisites:
 *   - ENCRYPTION_KEY env var must be set to the NEW key
 *   - OLD_ENCRYPTION_KEY env var must be set to the key that was used to encrypt existing rows
 *   - DATABASE_URL must point to the target database
 *
 * Safety:
 *   - Run with --dry-run first to verify decryption succeeds for all rows
 *   - Each row is updated in its own transaction — partial progress is safe
 *   - The script logs each row's status for auditability
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function decryptWithKey(encryptedData: string, key: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted data format');
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(key.slice(0, 32)),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encryptWithKey(apiKey: string, key: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(key.slice(0, 32)), iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

async function main() {
  const oldKey = process.env.OLD_ENCRYPTION_KEY;
  const newKey = process.env.ENCRYPTION_KEY;
  const dryRun = process.argv.includes('--dry-run');

  if (!oldKey || oldKey.length < 32) {
    console.error('❌ OLD_ENCRYPTION_KEY must be set and at least 32 characters');
    process.exit(1);
  }

  if (!newKey || newKey.length < 32) {
    console.error('❌ ENCRYPTION_KEY (new key) must be set and at least 32 characters');
    process.exit(1);
  }

  if (oldKey === newKey) {
    console.error('❌ OLD_ENCRYPTION_KEY and ENCRYPTION_KEY are identical — nothing to rotate');
    process.exit(1);
  }

  // Dynamic import to pick up env after dotenv loads
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const keys = await prisma.organizationApiKey.findMany();
    console.log(`Found ${keys.length} OrganizationApiKey row(s) to rotate`);

    if (dryRun) {
      console.log('🔍 DRY RUN — will verify decryption but not write changes\n');
    }

    let success = 0;
    let failed = 0;

    for (const row of keys) {
      try {
        const plaintext = decryptWithKey(row.encryptedKey, oldKey);
        const masked = plaintext.slice(0, 4) + '****' + plaintext.slice(-4);

        if (dryRun) {
          console.log(`  ✅ [DRY RUN] ${row.id} (${row.provider}) — decrypted OK: ${masked}`);
        } else {
          const newEncrypted = encryptWithKey(plaintext, newKey);

          await prisma.organizationApiKey.update({
            where: { id: row.id },
            data: { encryptedKey: newEncrypted },
          });

          console.log(`  ✅ ${row.id} (${row.provider}) — rotated: ${masked}`);
        }
        success++;
      } catch (err: any) {
        console.error(`  ❌ ${row.id} (${row.provider}) — FAILED: ${err.message}`);
        failed++;
      }
    }

    console.log(`\nDone. ${success} succeeded, ${failed} failed.`);
    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
