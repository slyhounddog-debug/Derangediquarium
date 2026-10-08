// Extracts the COMMITTED js/ tree (git HEAD) into a temp folder and returns its path — the "old code" for equivalence checks.
// (git archive | tar mis-parses a Windows drive letter, so this uses plain `git show` per file.)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export function extractOldJs(rev = 'HEAD') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finsanity_old_'));
  const files = execSync(`git ls-tree -r --name-only ${rev} js`, { cwd: repo }).toString().split(/\r?\n/).filter(Boolean);
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), execSync(`git show ${rev}:${f}`, { cwd: repo, maxBuffer: 64 * 1024 * 1024 }));
  }
  return path.join(dir, 'js');
}
