import fs from 'fs';
import path from 'path';

export const diskDirectory = process.env.INCIDENT_DISK_DIR || path.resolve(__dirname, '../logs');
export const debugLogPath = path.join(diskDirectory, 'audit-debug.log');

export function diskStats() {
  fs.mkdirSync(diskDirectory, { recursive: true });
  const stat = fs.statfsSync(diskDirectory);
  return {
    sizeBytes: stat.bsize * stat.blocks,
    availableBytes: stat.bsize * stat.bavail,
    fileSizeBytes: fs.existsSync(debugLogPath) ? fs.statSync(debugLogPath).size : 0,
  };
}
