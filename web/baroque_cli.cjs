// Shared architectural kernel for the Python entry point. No npm dependencies.
'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const M=require('./mcgen.js');
try{
  const spec=JSON.parse(fs.readFileSync(0,'utf8').replace(/^\uFEFF/,''));
  if(spec.style!=='baroque')throw Error('baroque_cli only accepts style=baroque');
  const r=M.cathedral(spec),m=r.S.toModel();
  if(r.placement.total)throw Error('Placement validation failed: '+JSON.stringify(r.placement));
  const answer={spec:r.spec,report:r.report,size:[m.W,m.H,m.L,r.S.blocks.size],placement:r.placement};
  const oi=process.argv.indexOf('--output');
  if(oi>=0){
    if(!process.argv[oi+1])throw Error('Missing output path');
    const file=path.resolve(process.argv[oi+1]);fs.mkdirSync(path.dirname(file),{recursive:true});
    const version=spec.game_version;
    if(version&&version!=='1.20.1'&&!M.GAME_VERSIONS.some(v=>v.id===version))throw Error('Unknown game_version: '+version);
    const nbt=!version||version==='1.20.1'?M.schemNBT(r.S,3465):M.schemNBT(r.S,null,version);
    fs.writeFileSync(file,zlib.gzipSync(nbt.bytes,{level:9}));
  }
  if(process.argv.includes('--model'))answer.blocks=[...r.S.blocks].map(([key,state])=>[...key.split(',').map(Number),state]);
  process.stdout.write(JSON.stringify(answer));
}catch(e){process.stderr.write(e.stack||String(e));process.exitCode=1;}
