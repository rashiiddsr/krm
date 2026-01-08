import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables as early as possible.
// In shared hosting (cPanel/LiteSpeed), the working directory can differ,
// so we try multiple candidate paths for the .env file.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];

let loadedPath = null;
for (const p of candidates) {
  try {
    if (fs.existsSync(p)) {
      dotenv.config({ path: p });
      loadedPath = p;
      break;
    }
  } catch {
    // ignore
  }
}

if (!loadedPath) {
  // Fallback to default behavior (looks for .env in process.cwd())
  dotenv.config();
}
