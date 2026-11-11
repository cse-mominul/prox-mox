import { createCipheriv, createDecipheriv, randomBytes, createHash, randomUUID } from 'crypto';
/** AES-256-GCM encryption for secrets at rest (e.g. Proxmox token secret). Key = 64 hex chars. */
function key(): Buffer {
  const hex = process.env.ENCRYPTION_KEY || '';
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error('ENCRYPTION_KEY must be 64 hex chars (openssl rand -hex 32)');
  return Buffer.from(hex, 'hex');
}
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), enc.toString('base64')].join('.');
}
export function decryptSecret(payload: string): string {
  const [iv, tag, data] = payload.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const newId = () => randomUUID();
export function randomToken(bytes = 32) { return randomBytes(bytes).toString('hex'); }
