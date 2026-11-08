import {copyFileSync} from 'node:fs';
copyFileSync(new URL('../src/frontend/env.json',import.meta.url),new URL('../src/frontend/dist/env.json',import.meta.url));
