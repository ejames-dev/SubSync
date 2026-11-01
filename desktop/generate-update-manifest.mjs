import path from 'node:path';
import { writeWindowsLatestYml } from './windows-latest-yml.mjs';

const root = path.resolve(import.meta.dirname, '..');
const manifestPath = await writeWindowsLatestYml({ root });
console.log(`Wrote ${path.relative(root, manifestPath)}`);
