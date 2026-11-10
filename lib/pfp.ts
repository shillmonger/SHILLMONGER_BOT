import fs from 'node:fs';
import path from 'node:path';

const PFP_DIR = path.join(process.cwd(), 'public', 'PFP_IMG');
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|jfif)$/i;

export function getPfpImages(): string[] {
  try {
    return fs
      .readdirSync(PFP_DIR)
      .filter((file) => IMAGE_EXT.test(file))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((file) => `/PFP_IMG/${file}`);
  } catch {
    return [];
  }
}

export function pickRandomPfp(): string | undefined {
  const images = getPfpImages();
  if (images.length === 0) return undefined;
  return images[Math.floor(Math.random() * images.length)];
}

// Maps legacy "/PFP_IMG/<n>.jfif" avatar paths to the renamed "pfp<n>.jpg"
// files when the renamed file actually exists on disk.
export function normalizePfpPath(avatar?: string | null): string | undefined {
  if (!avatar) return avatar ?? undefined;
  const match = avatar.match(/^\/PFP_IMG\/(\d+)\.jfif$/i);
  if (!match) return avatar;
  const renamed = `pfp${match[1]}.jpg`;
  try {
    return fs.existsSync(path.join(PFP_DIR, renamed))
      ? `/PFP_IMG/${renamed}`
      : avatar;
  } catch {
    return avatar;
  }
}
