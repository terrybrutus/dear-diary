import {spawnSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
const root=fileURLToPath(new URL('../',import.meta.url));process.chdir(root);
const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||(major===22&&minor<12)){console.error('Install Node.js 22.12+ (24 LTS recommended), then run this launcher again.');process.exit(1);}
const run=(cmd,args,opts={})=>spawnSync(cmd,args,{cwd:root,stdio:'inherit',...opts});
const git=(args,opts={})=>run('git',args,opts);
const status=git(['status','--porcelain'],{encoding:'utf8',stdio:'pipe'});
if(status.status!==0)console.warn('Git is unavailable. Starting the existing local code.');
else if(status.stdout.trim())console.warn('Local code changes detected; skipping update to protect your work. Starting your existing version.');
else{const pull=git(['pull','--ff-only']);if(pull.status!==0)console.warn('Could not update (offline or branch diverged). Starting the existing local code.');}
// shell is used only for a fixed package-manager command on Windows (.cmd shim).
const install=run('pnpm',['install','--frozen-lockfile'],{shell:process.platform==='win32'});
if(install.status!==0){if(!existsSync('src/frontend/node_modules/vite')){console.error('Dependency install failed. Install pnpm and check your network, then retry.');process.exit(1);}console.warn('Using installed dependencies; update was unavailable.');}
console.log('Starting Dear Diary. Keep this window open while using the journal.');
const child=spawn(process.execPath,['scripts/local.mjs','--open'],{cwd:root,stdio:'inherit'});child.on('exit',code=>process.exit(code||0));
