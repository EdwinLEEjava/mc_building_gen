#!/usr/bin/env node
// Command-line generator (replaces `python generate.py`):  node web/cli.js spec.json out.schem [--raw]
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const M = require('./mcgen.js');
M.initData(JSON.parse(fs.readFileSync(path.join(__dirname, 'mcgen_data.json'), 'utf8')));
const [specPath, outPath] = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!specPath || !outPath) { console.error('用法：node web/cli.js 参数.json 输出.schem [--raw]'); process.exit(1); }
const r = M.generate(JSON.parse(fs.readFileSync(specPath, 'utf8')), process.argv.includes('--raw'));
const nbt = M.schemNBT(r.structure);
fs.writeFileSync(outPath, zlib.gzipSync(Buffer.from(nbt.bytes)));
console.log(`${outPath}: ${nbt.W}x${nbt.H}x${nbt.L}, ${r.structure.blocks.size} blocks`);
for (const line of r.report) console.log('  ·', line);
