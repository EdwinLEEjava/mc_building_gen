/* Baroque cathedral, shared by the browser and Python entry points.
   Canonical construction faces north; the native adapter rotates it west. */
function makeBaroque(G, options={}) {
  const {Structure,B}=G, S=new Structure();
  const finite=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
  const seed=Math.trunc(finite(options.seed,1)), extraBays=Math.max(0,Math.min(3,Math.trunc(finite(options.extra_bays,0))));
  const naveWidth=Math.max(33,Math.min(49,2*Math.round((finite(options.nave_width,41)-1)/2)+1));
  const bodyHeight=Math.max(32,Math.min(46,Math.round(finite(options.body_height,34))));
  const half=(naveWidth-1)/2, rise=bodyHeight-34;
  // Finished floor is y=6. Extend structural spans, keeping ground-level details
  // and human doors in place; upper orders retain their original block profiles.
  const Y=y=>y<=12?y:y+rise;
  const furnished=options.interior!==false;
  const ornamentVariant=((seed%3)+3)%3;
  const M={wall:B('smooth_sandstone'),stone:B('cut_sandstone'),q:B('smooth_quartz'),pillar:B('quartz_pillar',{axis:'y'}),gold:B('gold_block'),roof:B('oxidized_cut_copper'),dark:B('dark_oak_planks'),glass:B('light_blue_stained_glass'),shadow:B('gray_terracotta'),base:B('stone_bricks')};
  const rawPut=(x,y,z,b)=>S.set(Math.round(x),Math.round(y),Math.round(z),b);
  function rawBox(x0,y0,z0,x1,y1,z1,b) {for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)rawPut(x,y,z,b);}
  const put=(x,y,z,b)=>rawPut(x,Y(y),z,b);
  const box=(x0,y0,z0,x1,y1,z1,b)=>rawBox(x0,Y(y0),z0,x1,Y(y1),z1,b);
  function line(a,b,mat,r=0){a=[a[0],Y(a[1]),a[2]];b=[b[0],Y(b[1]),b[2]];const box=rawBox;const n=Math.ceil(Math.hypot(...a.map((v,i)=>v-b[i]))*2);for(let i=0;i<=n;i++){const t=n?i/n:0;const p=a.map((v,k)=>Math.round(v+(b[k]-v)*t));box(p[0]-r,p[1]-r,p[2],p[0]+r,p[1]+r,p[2],mat);}}
  const stair=(face,mat='quartz',half='bottom')=>B(mat+'_stairs',{facing:face,half,shape:'straight',waterlogged:false});
  const slab=(mat='quartz',type='bottom')=>B(mat+'_slab',{type,waterlogged:false});
  function shell(x0,z0,x1,z1,y0,y1){box(x0,y0,z0,x1,y1,z1,M.wall);box(x0+2,y0,z0+2,x1-2,y1,z1-2,null);}
  function cornice(x0,z0,x1,z1,y){
    y=Y(y);const put=rawPut;
    for(let a=0;a<3;a++){const e=a===1?2:1, yy=y+a;for(let x=x0-e;x<=x1+e;x++){put(x,yy,z0-e,a===0?stair('south','quartz','top'):M.q);put(x,yy,z1+e,a===0?stair('north','quartz','top'):M.q);}for(let z=z0-e;z<=z1+e;z++){put(x0-e,yy,z,a===0?stair('east','quartz','top'):M.q);put(x1+e,yy,z,a===0?stair('west','quartz','top'):M.q);}}
  }
  function col(cx,cz,y0,y1,wide=1){
    y0=Y(y0);y1=Y(y1);const put=rawPut,box=rawBox;
    box(cx-wide-1,y0,cz-wide-1,cx+wide+1,y0+1,cz+wide+1,M.q);
    for(let y=y0+2;y<y1-2;y++)for(let dx=-wide;dx<=wide;dx++)for(let dz=-wide;dz<=wide;dz++)if(wide===0||Math.abs(dx)+Math.abs(dz)<=wide+1)put(cx+dx,y,cz+dz,M.pillar);
    box(cx-wide-1,y1-2,cz-wide-1,cx+wide+1,y1-2,cz+wide+1,M.q);
    box(cx-wide-1,y1-1,cz-wide-1,cx+wide+1,y1,cz+wide+1,M.q);
    for(const dx of [-wide-1,wide+1]){put(cx+dx,y1-2,cz-wide-1,M.gold);put(cx+dx,y1-2,cz+wide+1,M.gold);}
    {
      // A layered abacus, stepped corner volutes and leaf brackets made of stairs.
      for(const side of [-1,1])for(const d of [-wide-1,wide+1]){
        put(cx+side*(wide+1),y1-3,cz+d,stair(side<0?'east':'west','quartz','top'));
        put(cx+side*wide,y1-4,cz+d,stair(side<0?'west':'east'));
        put(cx+d,y1-3,cz+side*(wide+1),stair(side<0?'south':'north','quartz','top'));
      }
      for(let dx=-wide-1;dx<=wide+1;dx++)for(let dz=-wide-1;dz<=wide+1;dz++)if(Math.abs(dx)===wide+1||Math.abs(dz)===wide+1)put(cx+dx,y1+1,cz+dz,slab());
      box(cx-wide-1,y0+2,cz-wide-1,cx+wide+1,y0+2,cz+wide+1,slab());
    }
  }
  // Local facade coordinates: u horizontal, v height, d projects outward from wall.
  function facadeKit(cx,yb,wall,dir='n',world=false){
    const map=(u,y,d)=>dir==='n'?[cx+u,y,wall-d]:dir==='s'?[cx-u,y,wall+d]:dir==='w'?[wall-d,y,cx-u]:[wall+d,y,cx+u];
    const p=(u,y,d,b)=>{const [x,,z]=map(u,y,d);rawPut(x,world?y:Y(y),z,b);};
    const b=(u0,y0,d0,u1,y1,d1,mat)=>{
      const a=map(u0,y0,d0),b=map(u1,y1,d1);
      rawBox(Math.min(a[0],b[0]),world?y0:Y(y0),Math.min(a[2],b[2]),Math.max(a[0],b[0]),world?y1:Y(y1),Math.max(a[2],b[2]),mat);
    };
    const outward=dir==='n'?'south':dir==='s'?'north':dir==='w'?'east':'west';
    return {p,b,outward};
  }
  function relief(cx,wall,y,r=3,dir='n'){
    y=Y(y);const {p,b}=facadeKit(cx,y,wall,dir,true);
    b(-r,y,0,r,y+2*r,0,M.stone);
    for(const inset of [0,2]){const rr=r-inset;if(rr<0)continue;for(let u=-rr;u<=rr;u++){p(u,y+inset,1+inset*.5,M.q);p(u,y+2*r-inset,1+inset*.5,M.q);}for(let v=inset;v<=2*r-inset;v++){p(-rr,y+v,1+inset*.5,M.q);p(rr,y+v,1+inset*.5,M.q);}}
    if(ornamentVariant===0){b(-1,y+2,2,1,y+2*r-2,2,M.q);p(0,y+r,3,M.gold);}
    else if(ornamentVariant===1){for(const [u,v]of [[0,r-1],[-1,r],[1,r],[0,r+1]])p(u,y+v,2,M.q);p(0,y+r,2,M.gold);}
    else {for(let i=-2;i<=2;i++){p(i,y+r-Math.abs(i),2,M.q);p(i,y+r+Math.abs(i),2,M.q);}p(0,y+r,2,M.gold);}
  }
  function curvedHoodRaw(cx,wall,y,r,dir='n',heavy=false){
    const {p,b,outward}=facadeKit(cx,y,wall,dir,true);
    for(let u=-r;u<=r;u++){
      const h=y+Math.round((heavy?4:3)*Math.sqrt(Math.max(0,1-(u/(r+.5))**2)));
      if(Math.abs(u)>1){b(u,y,1,u,h,2,M.wall);b(u,h,2,u,h,heavy?4:3,M.q);p(u,h+1,heavy?4:3,slab());p(u,h-1,heavy?4:3,stair(outward,'quartz','top'));}
    }
    b(-1,y+2,2,1,y+5,3,M.q);p(0,y+3,4,M.gold);
    for(const s of [-1,1]){b(s*r,y-1,1,s*r,y,3,M.q);p(s*r,y-2,2,stair(outward,'quartz','top'));}
  }
  const curvedHood=(cx,wall,y,r,dir='n',heavy=false)=>curvedHoodRaw(cx,wall,Y(y),r,dir,heavy);
  function richWindow(cx,wall,base,spring,r,dir='n',hood=true){
    base=Y(base);spring=Y(spring);const {p,b,outward}=facadeKit(cx,base,wall,dir,true);
    // Layered archivolts remain outside the real glazed opening.
    for(let u=-r-2;u<=r+2;u++)for(let y=base;y<=spring+r+2;y++){
      const dy=Math.max(0,y-spring),d=Math.hypot(u,dy);
      if(y<=spring?Math.abs(u)===r+2: d>=r+1.45&&d<=r+2.4)p(u,y,1,M.q);
    }
    b(-r-2,base-2,1,r+2,base-2,3,M.q);
    for(const s of [-1,1]){p(s*(r+1),base-3,2,stair(outward,'quartz','top'));p(s*r,base-4,1,M.q);}
    p(0,spring+r+1,2,M.gold);
    if(hood)curvedHoodRaw(cx,wall,spring+r+3,r+3,dir);
  }
  // Round-headed window or doorway, mapped to any axis-aligned wall. Width=2r+1.
  function arch(cx,zb,base,spring,r,dir='n',fill=M.glass,depth=2){
    base=Y(base);spring=Y(spring);const put=rawPut;
    const at=(u,y,d,b)=>dir==='n'||dir==='s'?put(cx+u,y,zb+d,b):put(zb+d,y,cx+u,b);
    for(let u=-r-1;u<=r+1;u++)for(let y=base-1;y<=spring+r+1;y++){
      const dy=Math.max(0,y-spring), inside=Math.abs(u)<=r && u*u+dy*dy<=(r+.2)*(r+.2),outer=u*u+dy*dy<=(r+1.45)*(r+1.45);
      if(inside&&y>=base)for(let d=0;d<depth;d++)at(u,y,d,d===Math.floor(depth/2)?fill:null);
      else if(outer&&(Math.abs(u)>=r||y>spring||y===base-1))at(u,y,dir==='n'||dir==='w'?-1:depth,M.q);
    }
    for(let u=-r-1;u<=r+1;u++)at(u,base-1,dir==='n'||dir==='w'?-2:depth+1,M.q);
    if(fill===M.glass){for(let y=base;y<=spring+r;y++)at(0,y,Math.floor(depth/2),M.q);for(let u=-r;u<=r;u++)at(u,spring-1,Math.floor(depth/2),M.q);}
    at(0,spring+r+1,dir==='n'||dir==='w'?-1:depth,M.gold);
  }
  function crossRaw(cx,y,z){rawBox(cx,y,z,cx,y+5,z,M.gold);rawBox(cx-2,y+3,z,cx+2,y+3,z,M.gold);}
  const cross=(cx,y,z)=>crossRaw(cx,Y(y),z);
  function urn(cx,y,z){y=Y(y);const box=rawBox,put=rawPut;box(cx-1,y,z-1,cx+1,y,z+1,M.q);put(cx,y+1,z,M.pillar);box(cx-1,y+2,z-1,cx+1,y+3,z+1,M.q);put(cx,y+4,z,M.gold);}
  function hip(x0,z0,x1,z1,y,h){y=Y(y);const box=rawBox,put=rawPut;for(let k=0;k<h;k++){box(x0+k,y+k,z0+k,x1-k,y+k,z1-k,M.roof);for(let x=x0+k;x<=x1-k;x++){put(x,y+k,z0+k,stair('south','oxidized_cut_copper'));put(x,y+k,z1-k,stair('north','oxidized_cut_copper'));}for(let z=z0+k;z<=z1-k;z++){put(x0+k,y+k,z,stair('east','oxidized_cut_copper'));put(x1-k,y+k,z,stair('west','oxidized_cut_copper'));}}}
  function domeRaw(cx,cz,y0,r,h,lantern=true){
    const put=rawPut,box=rawBox;
    for(let dy=0;dy<=h;dy++){
      const rr=r*Math.sqrt(Math.max(0,1-(dy/h)**2));
      for(let dx=-r-1;dx<=r+1;dx++)for(let dz=-r-1;dz<=r+1;dz++){
        const d=Math.hypot(dx,dz);if(d<=rr+.45&&d>=Math.max(0,rr-1.2)){
          const a=Math.atan2(dz,dx),rib=Math.abs(Math.sin(a*8))<.19;
          put(cx+dx,y0+dy,cz+dz,rib?M.q:M.roof);
        }
      }
    }
    if(lantern){const y=y0+h;for(let dy=0;dy<9;dy++)for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++)if(dx*dx+dz*dz<=12){if(dy===0||dy===7||dy===8)put(cx+dx,y+dy,cz+dz,M.q);else if(Math.abs(dx)===2&&Math.abs(dz)===2)put(cx+dx,y+dy,cz+dz,M.pillar);}
      domeRaw(cx,cz,y+9,4,5,false);crossRaw(cx,y+15,cz);}
  }
  const dome=(cx,cz,y0,r,h,lantern=true)=>domeRaw(cx,cz,Y(y0),r,h,lantern);
  // A self-contained stone island and formal forecourt.
  box(0,0,0,120,1,138,M.base);
  for(let x=0;x<=120;x++)for(let z=0;z<=138;z++)put(x,2,z,(x%12===0||z%12===0)?M.q:((Math.floor(x/4)+Math.floor(z/4))%2?B('polished_andesite'):B('smooth_stone')));
  for(let d=0;d<=2;d++){box(d,2+d,d,120-d,2+d,d,M.q);box(d,2+d,138-d,120-d,2+d,138-d,M.q);box(d,2+d,d,d,2+d,138-d,M.q);box(120-d,2+d,d,120-d,2+d,138-d,M.q);}
  box(14,3,23,106,5,128,M.stone);box(18,6,27,102,6,126,M.q);
  for(let i=0;i<4;i++)box(35-i*2,3+i,15+i*2,85+i*2,3+i,23,M.q);
  // Side aisles, lofty nave and transept, all hollow and connected.
  shell(30,38,90,116,7,25);cornice(30,38,90,116,24);
  shell(60-half,37,60+half,122,7,40);cornice(60-half,37,60+half,122,39);
  shell(18,77,102,96,7,36);cornice(18,77,102,96,35);
  // Open connections through the internal walls, retaining pier bays.
  for(const z of [47,61,75,89,103,114])for(const x of [60-half,59+half])box(x,7,z-4,x+1,23,z+4,null);
  box(62-half,7,77,58+half,33,79,null);box(62-half,7,94,58+half,33,96,null);
  // Sanctuary in a polygonal apse at the east end.
  for(let x=40;x<=80;x++)for(let z=113;z<=132;z++){const d=Math.hypot(x-60,z-113);if(d<=20){if(d>17)box(x,7,z,x,35,z,M.wall);put(x,6,z,M.q);if(d>17)for(let y=34;y<=36;y++)put(x,y,z,M.q);}}
  // Pitched copper roof sections, with deep eaves and pale ridges.
  const aisleRoof=Math.floor((32-half)/2);
  hip(28,39,59-half,115,27,aisleRoof);hip(61+half,39,92,115,27,aisleRoof);
  hip(58-half,38,62+half,123,42,10);box(68-half,52,48,52+half,52,117,M.roof);box(59,53,49,61,53,116,M.q);
  hip(16,75,104,98,38,11);box(27,49,85,93,49,88,M.roof);
  dome(60,113,37,20,11,false);
  // Side elevations: giant pilasters, lower arched lights, clerestory.
  for(const x of [30,89])for(const z of [46,60,106])arch(z,x,11,18,3,x===30?'w':'e',M.glass,2);
  for(const x of [60-half,59+half])for(const z of [48,63,108,117])arch(z,x,30,34,2,x===60-half?'w':'e',M.glass,2);
  for(const x of [28,92])for(const z of [38,53,69,100,116]){box(x-1,7,z-1,x+1,24,z+1,M.q);box(x-2,24,z-2,x+2,26,z+2,M.q);urn(x,28,z);}
  for(const x of [18,101])for(const z of [82,91])arch(z,x,12,24,3,x===18?'w':'e',M.glass,2);
  for(const x of [16,104])for(const z of [77,96])col(x,z,7,35,1);
  for(const x of [47,60,73])arch(x,121,12,24,3,'s',M.glass,3);
  // Crossing drum, eight paired orders, open oculi and ribbed copper dome.
  const dcx=60,dcz=86,rr=17;
  for(let y=43;y<=56;y++)for(let dx=-rr;dx<=rr;dx++)for(let dz=-rr;dz<=rr;dz++){const d=Math.hypot(dx,dz);if(d<=rr&&d>=rr-2.2)put(dcx+dx,y,dcz+dz,(y===43||y>=54)?M.q:M.wall);}
  for(const zz of [dcz-17,dcz+15])for(const xx of [53,60,67])arch(xx,zz,46,50,2,zz<dcz?'n':'s',M.glass,3);
  for(const xx of [dcx-17,dcx+15])for(const zz of [79,86,93])arch(zz,xx,46,50,2,xx<dcx?'w':'e',M.glass,3);
  for(let i=0;i<16;i++){const a=i*Math.PI/8, x=Math.round(dcx+17*Math.cos(a)),z=Math.round(dcz+17*Math.sin(a));box(x,44,z,x,54,z,M.pillar);put(x,55,z,M.gold);}
  for(let dy=0;dy<2;dy++)for(let dx=-19;dx<=19;dx++)for(let dz=-19;dz<=19;dz++){const d=Math.hypot(dx,dz);if(d>=16&&d<=18.5)put(dcx+dx,56+dy,dcz+dz,M.q);}
  dome(dcx,dcz,58,18,20);
  // Twin belfries: broad base, clock storey, open bell chamber, lantern & bulbous cap.
  for(const cx of [25,95]){
    const z0=25,z1=43;
    shell(cx-9,z0,cx+9,z1,7,40);
    for(const y of [7,22,39])cornice(cx-9,z0,cx+9,z1,y);
    for(const xx of [cx-8,cx+8])for(const zz of [z0-1,z1+1])col(xx,zz,9,38,1);
    arch(cx,z0,11,20,3,'n',M.glass,2);
    shell(cx-7,27,cx+7,41,42,58);cornice(cx-7,27,cx+7,41,57);
    // Clock medallion in front and on outer side, actual patterned full blocks.
    for(let u=-4;u<=4;u++)for(let v=-4;v<=4;v++){const d=Math.hypot(u,v);if(d<=4.4)put(cx+u,49+v,26,d>3.35?M.gold:M.q);}
    box(cx,49,25,cx,52,25,M.shadow);box(cx,49,25,cx+2,49,25,M.shadow);
    if(seed!==1){for(let dx=-3;dx<=3;dx++)for(let dy=-3;dy<=3;dy++)if(Math.hypot(dx,dy)<=3.2)put(cx+dx,49+dy,25,M.q);
      const hour=((seed-1)%12+12)%12*Math.PI/6;line([cx,49,25],[cx+Math.sin(hour)*2,49+Math.cos(hour)*2,25],M.shadow);line([cx,49,25],[cx+2,49,25],M.shadow);}
    for(const xx of [cx-7,cx+7])box(xx,44,26,xx,56,26,M.pillar);
    shell(cx-6,28,cx+6,40,60,74);cornice(cx-6,28,cx+6,40,73);
    arch(cx,28,62,69,3,'n',null,2);arch(cx,39,62,69,3,'s',null,2);
    arch(34,cx-6,62,69,3,'w',null,2);arch(34,cx+5,62,69,3,'e',null,2);
    for(const xx of [cx-6,cx+6])for(const zz of [28,40])col(xx,zz,61,73,0);
    // Bell suspended from a structural crossbeam.
    box(cx-4,72,34,cx+4,72,34,M.dark);box(cx,68,34,cx,71,34,M.gold);box(cx-1,66,33,cx+1,68,35,M.gold);box(cx-2,65,32,cx+2,65,36,M.gold);
    const profile=[6,6,5,4,4,5,5,4,3,2,1];
    for(let j=0;j<profile.length;j++)for(let dx=-7;dx<=7;dx++)for(let dz=-7;dz<=7;dz++){const d=Math.hypot(dx,dz);if(d<=profile[j]+.3&&d>=profile[j]-1.1)put(cx+dx,77+j,34+dz,M.roof);}
    box(cx-1,88,33,cx+1,89,35,M.q);cross(cx,90,34);
    for(const xx of [cx-9,cx+9])for(const zz of [25,43])urn(xx,42,zz);
  }
  // The undulating screen: convex central bay / concave intermediate bays.
  const front=x=>Math.round(27-4*Math.cos((x-60)*Math.PI/16));
  for(let x=34;x<=86;x++){const z=front(x);box(x,7,z,x,41,39,M.wall);
    for(const y of [7,8,39,40,41,42])box(x,y,z-1,x,y,z+2,M.q);
    put(x,38,z-1,stair('south','quartz','top'));
  }
  // Carve a true vestibule behind the entrance, joining the nave.
  box(55,7,25,65,23,42,null);
  // Grand central portal with a deep round arch and inset timber leaves.
  arch(60,23,7,17,5,'n',null,7);
  box(56,7,28,64,18,28,M.dark);box(60,7,27,60,18,27,M.q);
  for(const xx of [57,63]){box(xx,9,27,xx,15,27,B('stripped_dark_oak_log',{axis:'y'}));put(xx===57?59:61,11,26,M.gold);}
  for(let dx=-4;dx<=4;dx++)for(let y=19;y<=22;y++)if(dx*dx+(y-17)**2<=25)put(60+dx,y,28,M.glass);
  // Oversized paired columns carrying one continuous entablature.
  for(const x of [36,41,49,53,67,71,79,84])col(x,front(x)-3,9,38,1);
  // Deep secondary niches with miniature figure-like stone monuments.
  for(const x of [43,77]){arch(x,front(x),13,23,2,'n',M.shadow,5);const z=front(x)-1;box(x-1,12,z,x+1,13,z,M.q);box(x,14,z,x,19,z,M.q);box(x-1,16,z,x+1,16,z,M.q);put(x,20,z,M.gold);}
  // Upper central order and large arched window.
  for(let x=46;x<=74;x++){const z=front(x)+1;box(x,43,z,x,56,z+5,M.wall);box(x,54,z-1,x,56,z+5,M.q);}
  arch(60,24,43,48,4,'n',M.glass,5);
  for(const x of [48,52,68,72])col(x,front(x)-1,43,54,0);
  // Scroll shoulders, solid tapered infill with white spiral relief.
  for(const side of [-1,1]){
    for(let u=0;u<=13;u++){const top=Math.round(43+12*(1-u/13)**2),x=60+side*(14+u),z=front(x)+1;box(x,43,z,x,top,z+3,M.wall);box(x,top,z-1,x,top+1,z,M.q);}
    const cx=60+side*21,cy=46,cz=front(cx)-1;
    let prev=null;for(let t=0;t<=Math.PI*3.15;t+=.045){const r=5.3*(1-t/(Math.PI*3.5)),p=[cx+side*r*Math.cos(t),cy+r*Math.sin(t),cz];if(prev)line(prev,p,M.q);prev=p;}put(cx,cy,cz-1,M.gold);
  }
  // Broken curved pediment above the centre: raised pale arcs and gilded crest.
  for(let dx=-17;dx<=17;dx++){const h=Math.round(57+7*Math.sqrt(Math.max(0,1-(dx/18)**2)));if(Math.abs(dx)>3){box(60+dx,56,24,60+dx,h,28,M.wall);box(60+dx,h,22,60+dx,h+1,25,M.q);}}
  box(58,56,23,62,63,27,M.q);box(59,58,22,61,61,22,M.gold);urn(60,64,25);
  for(const x of [37,45,75,83])urn(x,44,front(x));
  // Interior: patterned aisle floor, tall paired piers, gallery, pews, altar and a vault.
  for(let x=33;x<=87;x++)for(let z=42;z<=119;z++)if(S.has(x,5,z))put(x,6,z,(x>=56&&x<=64)?((z%5===0)?M.gold:M.q):((Math.floor(x/3)+Math.floor(z/3))%2?B('polished_diorite'):B('polished_blackstone')));
  for(const x of [63-half,57+half])for(const z of [49,63,105,117])col(x,z,7,37,1);
  if(furnished){
    for(const z of [47,54,61,68,105,112])for(const side of [-1,1]){const xx=60+side*(half-9);box(xx-5,7,z,xx+5,7,z+1,M.dark);box(xx-5,8,z+1,xx+5,9,z+1,M.dark);}
    box(49,7,116,71,8,126,M.q);box(51,9,119,69,9,125,M.q);box(55,10,121,65,12,123,M.gold);box(56,13,121,64,13,123,M.q);cross(60,15,125);
  }
  for(const x of [48,72])col(x,124,9,30,1);
  for(let z=43;z<122;z++)for(let dx=3-half;dx<=half-3;dx++){const yy=31+Math.round(10*Math.sqrt(Math.max(0,1-(dx/(half-2))**2)));if(!(z>=68&&z<=103))put(60+dx,yy,z,M.q);}
  // The dome opens into the crossing, rather than sitting on a closed roof.
  for(let dx=-14;dx<=14;dx++)for(let dz=-14;dz<=14;dz++)if(Math.hypot(dx,dz)<14.5)box(60+dx,36,86+dz,60+dx,57,86+dz,null);
  // Rear apse articulation follows the curve, with a real exterior sanctuary light.
  arch(60,130,13,25,3,'s',M.glass,3);
  for(const a of [.2,.64,1.1,1.57,2.04,2.5,2.94]){const x=Math.round(60+20*Math.cos(a)),z=Math.round(113+20*Math.sin(a));box(x,7,z,x,33,z,M.pillar);box(x-1,33,z-1,x+1,35,z+1,M.q);}
  // Human-scale operable double doors inset in the monumental timber portal.
  box(59,7,27,60,9,29,null);box(59,9,27,60,9,28,M.dark);
  for(const [x,hinge]of [[59,'left'],[60,'right']])for(const [y,half]of [[7,'lower'],[8,'upper']])put(x,y,28,B('dark_oak_door',{facing:'north',half,hinge,open:false,powered:false}));
  {
    // 01 Monumental portal: concentric stone arch, paired jambs and deep curved hood.
    richWindow(60,23,7,17,5,'n',false);
    for(const x of [52,68])col(x,20,7,23,0);
    for(let u=-7;u<=7;u++){
      const yy=17+Math.round(Math.sqrt(Math.max(0,49-u*u)));
      box(60+u,yy,19,60+u,yy,21,M.q);put(60+u,yy+1,19,slab());
    }
    curvedHood(60,23,25,9,'n',true);
    box(58,29,18,62,33,20,M.q);box(59,30,17,61,32,17,M.gold);
    for(const side of [-1,1]){put(60+side*3,31,18,stair(side<0?'east':'west'));put(60+side*2,28,18,stair(side<0?'west':'east','quartz','top'));}
    // Tall stone niches gain a deeper base, shell-like head and solid stepped figure.
    for(const x of [43,77]){const z=front(x);richWindow(x,z,13,23,2,'n',false);box(x-2,10,z-3,x+2,11,z-1,M.q);put(x,12,z-2,slab());put(x,20,z-2,M.q);put(x,21,z-2,M.gold);}
    // 02 Sculptural S-volutes. The old thin spirals are replaced by connected ribbons
    // with a four-block backing and a projecting white front; all voxels are integral.
    const pts=[[47,55],[45,53],[42,51],[39,51]];
    for(let t=0;t<=1;t+=.02){const a=Math.PI/2+t*Math.PI*2.3,r=5-4*t;pts.push([39+r*Math.cos(a),46+r*Math.sin(a)]);}
    for(const side of [-1,1]){
      const mx=x=>side<0?x:120-x;
      for(let x=32;x<=45;x++)box(mx(x),42,20,mx(x),54,34,null);
      // Shoulder infill ties the descending scroll back to the upper central order.
      for(let x=35;x<=46;x++){const top=Math.round(43+11*((x-35)/11)**1.65);box(mx(x),42,28,mx(x),top,34,M.wall);}
      for(let x=33;x<=45;x++)for(let y=41;y<=52;y++)if(Math.hypot(x-39,y-46)<=6.1)box(mx(x),y,29,mx(x),y,32,M.wall);
      const sampled=[];for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1];for(let t=0;t<=1;t+=.05)sampled.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
      for(let x=33;x<=48;x++)for(let y=41;y<=56;y++){
        const d=Math.min(...sampled.map(p=>Math.hypot(x-p[0],y-p[1])));
        if(d<.95){box(mx(x),y,25,mx(x),y,28,M.q);}
      }
      put(mx(39),46,26,M.gold);box(Math.min(mx(35),mx(43)),41,28,Math.max(mx(35),mx(43)),41,31,M.q);
    }
    // 03 Front windows and formerly empty tower bays receive framed relief.
    for(const cx of [25,95]){
      richWindow(cx,25,11,20,3,'n');relief(cx,25,29,3,'n');
      for(const dir of ['w','e']){const wall=cx+(dir==='w'?-9:9);relief(34,wall,29,3,dir);}
      // Four clock-storey faces, corner returns and corbelled bell-chamber cornices.
      for(const [dir,c,w]of [['n',cx,27],['s',cx,41],['w',34,cx-7],['e',34,cx+7]]){
        const {p,b}=facadeKit(c,44,w,dir);
        for(let u=-5;u<=5;u++)for(let v=-5;v<=5;v++){const d=Math.hypot(u,v);if(d>=4.7&&d<=5.7)p(u,49+v,1,M.q);}
        if(dir!=='n'){b(-3,45,0,3,53,0,M.stone);for(let u=-3;u<=3;u++){p(u,45,1,M.q);p(u,53,1,M.q);}for(let y=45;y<=53;y++){p(-3,y,1,M.q);p(3,y,1,M.q);}}
        for(const u of [-4,0,4]){p(u,57,2,stair(dir==='n'?'south':dir==='s'?'north':dir==='w'?'east':'west','quartz','top'));p(u,73,2,M.gold);}
      }
      cornice(cx-6,28,cx+6,40,74);
    }
    // 04 Repeat the same window/cornice language around both side elevations.
    for(const x of [30,90])for(const z of [46,60,106])richWindow(z,x,11,18,3,x===30?'w':'e');
    for(const x of [18,102])for(const z of [82,91])richWindow(z,x,12,24,3,x===18?'w':'e',false);
    for(const x of [28,92])for(const z of [38,53,69,100,116]){
      const dir=x<60?'w':'e',{p}=facadeKit(z,7,x,dir);
      for(const u of [-2,2]){p(u,22,1,stair(u<0?'south':'north','quartz','top'));p(u,23,1,M.gold);}
    }
    for(const x of [60-half,60+half])for(const z of [48,63,108,117])richWindow(z,x,30,34,2,x===60-half?'w':'e',false);
    // The curved apse gets the same layered archivolt, preserving its actual glazing.
    richWindow(60,132,13,25,3,'s',false);
  }
  {
    // 05 Interior arcades are carved as true connected openings, not painted arches.
    const bays=[[42,53],[56,68],[99,110],[112,121]];
    for(const wall of [60-half,59+half])for(const [za,zb]of bays){
      const mid=(za+zb)/2,r=(zb-za)/2;
      for(let z=za;z<=zb;z++){const top=21+Math.round(8*Math.sqrt(Math.max(0,1-((z-mid)/(r+.5))**2)));box(wall,7,z,wall+1,top,z,null);box(wall-1,top+1,z,wall+2,top+2,z,M.q);}
    }
    // The transverse walls carry large round arches instead of flat low lintels.
    for(const [za,zb]of [[77,79],[94,96]])for(let x=62-half;x<=58+half;x++){
      const top=30+Math.round(10*Math.sqrt(Math.max(0,1-((x-60)/(half-1))**2)));
      box(x,7,za,x,top,zb,null);box(x,top+1,za,x,top+2,zb,M.q);
    }
    // Open the nave's former end wall into the real apse. Without this opening,
    // its old flat windows would hide most of the retable's engaged columns.
    box(63-half,7,120,57+half,35,123,null);
    for(let x=63-half;x<=57+half;x++){
      const top=31+Math.round(5*Math.sqrt(Math.max(0,1-((x-60)/(half-2))**2)));
      box(x,top+1,120,x,top+2,123,M.q);
    }
    // A continuous entablature and warm wall lamps suspended from real supports.
    for(const x of [62-half,58+half]){box(x,31,42,x,32,121,M.q);for(const z of [49,63,105,117]){box(x,28,z,x,30,z,M.q);put(x+(x<60?1:-1),29,z,B('glowstone'));}}
    // Geometric relief panels and secondary engaged orders in the aisles.
    for(const x of [32,88])for(const z of [52,66,109]){relief(z,x,11,3,x===32?'e':'w');}
    // Structural barrel vault: ribs, crown bosses and transverse arches follow the
    // existing shell. The crossing is kept open to the drum above.
    for(const z of [45,55,66,105,116]){
      for(let dx=3-half;dx<=half-3;dx++){
        const y=31+Math.round(10*Math.sqrt(Math.max(0,1-(dx/(half-2))**2)));
        box(60+dx,y-2,z-1,60+dx,y,z+1,M.q);put(60+dx,y-3,z,slab());
      }
      put(60,38,z,M.gold);
    }
    // An independent white inner dome lining leaves the copper outer shell intact.
    for(let dy=0;dy<20;dy++){
      const r=18*Math.sqrt(Math.max(0,1-(dy/20)**2));
      for(let dx=-17;dx<=17;dx++)for(let dz=-17;dz<=17;dz++){
        const d=Math.hypot(dx,dz);if(d<=r-1.35&&d>=Math.max(0,r-2.3))put(60+dx,58+dy,86+dz,M.q);
      }
    }
    if(furnished){
    // 06 Tall altar retable with paired orders, gilded cross, stepped broken pediment.
    box(49,9,122,71,10,126,M.q);box(53,11,123,67,29,125,M.wall);
    box(56,14,122,64,25,122,M.shadow);box(57,15,121,63,24,121,M.gold);box(58,16,120,62,23,120,M.wall);cross(60,17,119);
    for(const x of [51,54,66,69])col(x,122,10,29,0);
    curvedHood(60,124,29,11,'n',true);
    box(56,10,118,64,12,120,M.q);box(57,11,117,63,11,117,M.gold);box(55,13,117,65,13,121,M.q);
    for(const x of [50,70]){put(x,14,120,M.gold);put(x,15,120,B('sea_lantern'));}
    for(const x of [48,72])relief(x,126,14,2,'n');
    }
  }
  // Low formal gardens: restrained so the architecture remains the focal point.
  for(const [x0,z0,x1,z1]of [[7,52,23,69],[97,52,113,69],[7,105,23,125],[97,105,113,125]]){
    box(x0,3,z0,x1,3,z1,B('grass_block',{snowy:false}));
    for(let x=x0;x<=x1;x++)for(const z of [z0,z1])box(x,4,z,x,5,z,B('oak_leaves',{persistent:true,distance:1,waterlogged:false}));
    for(let z=z0;z<=z1;z++)for(const x of [x0,x1])box(x,4,z,x,5,z,B('oak_leaves',{persistent:true,distance:1,waterlogged:false}));
    for(const x of [x0+4,x1-4])for(const z of [z0+4,z1-4]){box(x,4,z,x,7,z,B('oak_leaves',{persistent:true,distance:1,waterlogged:false}));put(x,8,z,B('oak_leaves',{persistent:true,distance:1,waterlogged:false}));}
  }
  // Four stone lamps, no unsupported lanterns.
  for(const x of [22,98])for(const z of [9,18]){box(x-1,3,z-1,x+1,4,z+1,M.q);box(x,5,z,x,9,z,M.pillar);put(x,10,z,B('sea_lantern'));put(x,11,z,slab());}
  // Add full architectural bays by repeating a real nave segment, including piers,
  // aisle windows, roof, pews and foundations; no stretching or scaled block states.
  if(extraBays){const source=[...S.blocks],N=new Map(),add=14*extraBays;
    for(const [key,state]of source){const [x,y,z]=key.split(',').map(Number);N.set(x+','+y+','+(z>=68?z+add:z),state);
      if(z>=54&&z<68)for(let n=1;n<=extraBays;n++)N.set(x+','+y+','+(z+14*n),state);}
    S.blocks=N;
  }
  if(options.roof==='slate')for(const [key,state]of S.blocks){if(state.includes('oxidized_cut_copper'))S.blocks.set(key,state.replace('oxidized_cut_copper_stairs','deepslate_tile_stairs').replace('oxidized_cut_copper','deepslate_tiles'));}
  if(options.walls==='ivory')for(const [key,state]of S.blocks){if(state==='minecraft:smooth_sandstone')S.blocks.set(key,'minecraft:calcite');if(state==='minecraft:cut_sandstone')S.blocks.set(key,'minecraft:polished_diorite');}
  G.stairShapes(S);G.fixConnections(S);
  const placement=G.checkPlacement(S),[[x0,,z0],[x1,,z1]]=S.bounds();
  const spec={name:'巴洛克式教堂',style:'baroque',front:'north (-Z)',seed,nave_width:naveWidth,body_height:bodyHeight,extra_bays:extraBays,interior:furnished,roof:options.roof==='slate'?'slate':'copper',walls:options.walls==='ivory'?'ivory':'sandstone',features:['layered entrance','sculptural volutes','stepped capitals','relief wall panels','layered belfries','ribbed barrel vault','altar retable'],gameVersion:'1.20.1'};
  return {S,placement,report:[`巴洛克式：中殿宽 ${naveWidth} 格，主体墙高 ${bodyHeight} 格（自 y=6 的室内地面起）；新增中殿 ${extraBays} 开间，种子 ${seed}`,`放置检查 ${placement.total} 项问题；屋顶 ${spec.roof}，墙体 ${spec.walls}`],spec,foot:[x0,x1,z0,z1],tags:['landmark','cathedral','baroque'],adjust:[]};
}


// Native cathedral coordinates: west-facing entrance, centred for component/town placement.
const BAROQUE_DEFAULT = {style:'baroque',seed:1,nave_width:41,body_height:34,extra_bays:0,interior:true,roof:'copper',walls:'sandstone'};
function baroqueCathedral(o={}) {
  const r=makeBaroque({Structure,B,PyRandom,stairShapes,fixConnections,checkPlacement},o);
  const maxZ=r.S.bounds()[1][2], shifted=new Map();
  for(const [key,state]of rotQuarter(r.S.blocks,3)){
    const [x,y,z]=key.split(',').map(Number);shifted.set((x-Math.floor(maxZ/2))+','+y+','+(z+60),state);
  }
  r.S.blocks=shifted;r.S.box=null;
  const [[x0,,z0],[x1,,z1]]=r.S.bounds();r.foot=[x0,x1,z0,z1];
  r.spec={...r.spec,type:'cathedral',front:'west (-X)'};
  const requested=Number(o.extra_bays);
  if(o.extra_bays!==undefined&&requested!==r.spec.extra_bays)r.adjust.push({key:'extra_bays',got:r.spec.extra_bays,why:'新增中殿开间为0–3的整数，每开间14格'});
  for(const key of ['nave_width','body_height'])if(o[key]!==undefined&&Number(o[key])!==r.spec[key])r.adjust.push({key,got:r.spec[key],why:key==='nave_width'?'中殿宽为33–49的奇数':'主体墙高为32–46的整数，自室内地面起计'});
  r.placement=checkPlacement(r.S);return r;
}
CATHEDRAL_STYLES.baroque='巴洛克式';
CATHEDRAL_PRESETS.baroque=BAROQUE_DEFAULT;
