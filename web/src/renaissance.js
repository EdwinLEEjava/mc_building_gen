function renaissanceLayout(options){
  const number=(key,fallback)=>Number.isFinite(Number(options[key]))?Number(options[key]):fallback;
  const width=Math.max(23,Math.min(35,2*Math.round((number('nave_width',27)-1)/2)+1));
  const height=Math.max(25,Math.min(39,Math.round(number('body_height',27))));
  return {width,height,half:(width-1)/2,Y:y=>y<=8?y:y+height-27};
}
// Native Renaissance style. Default geometry matches the approved V3 sample.
function renaissanceShell(M, options={}){
  const S=new M.Structure(), B=M.B;
  const cream='smooth_sandstone', white='smooth_quartz', shadow='cut_sandstone', base='stone_bricks';
  const {half:n,Y}=renaissanceLayout(options);
  const rawPut=(x,y,z,m)=>S.set(x,y,z,B(m)),rawDel=(x,y,z)=>S.del(x,y,z);
  const rawBox=(x0,y0,z0,x1,y1,z1,m)=>{for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)rawPut(x,y,z,m);};
  const rawClear=(x0,y0,z0,x1,y1,z1)=>{for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)rawDel(x,y,z);};
  const put=(x,y,z,m)=>rawPut(x,Y(y),z,m),del=(x,y,z)=>rawDel(x,Y(y),z);
  const box=(x0,y0,z0,x1,y1,z1,m)=>rawBox(x0,Y(y0),z0,x1,Y(y1),z1,m);
  const clear=(x0,y0,z0,x1,y1,z1)=>rawClear(x0,Y(y0),z0,x1,Y(y1),z1);
  const cx=12, R=16;
  function zone(x,z){
    let h=0;
    if(x>=-39&&x<=43&&Math.abs(z)<=25)h=18;
    if(x>=-39&&x<=43&&Math.abs(z)<=n)h=30;
    if(x>=-3&&x<=27&&Math.abs(z)<=34)h=Math.max(h,30);
    if(x>43&&(x-43)**2+z*z<=14*14)h=30;
    return h;
  }
  // The church is a hollow Latin-cross basilica with lower side aisles.
  for(let x=-39;x<=57;x++)for(let z=-34;z<=34;z++){
    const h=zone(x,z);if(!h)continue;
    box(x,0,z,x,2,z,base);
    put(x,3,z,((Math.floor((x+40)/4)+Math.floor((z+36)/4))%2)?'polished_diorite':'smooth_sandstone');
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
      const other=zone(x+dx,z+dz);
      if(other<h)box(x,other?other+1:4,z,x,h,z,cream);
    }
    put(x,h+1,z,'bricks');
    if(h===30&&Math.abs(z)<=n){
      const ry=h+2+Math.round((n-Math.abs(z))*0.34);
      put(x,ry,z,'brick_slab');
      for(let y=h+2;y<ry;y++)if(x===-39||x===43)put(x,y,z,cream);
    }else if(h===18){
      const ry=h+2+Math.round((25-Math.abs(z))*0.32);
      put(x,ry,z,'bricks');
    }
  }
  // Classical side elevations: pilasters, banded entablatures and round windows.
  function roundWindow(axis,fixed,mid,sill,w,hh){
    hh=Y(sill+hh)-Y(sill);sill=Y(sill);const put=rawPut;
    for(let u=-w-1;u<=w+1;u++)for(let y=sill-1;y<=sill+hh+w+1;y++){
      const top=sill+hh+Math.sqrt(Math.max(0,w*w-u*u));
      const outer=Math.abs(u)<=w+1&&y<=sill+hh+Math.sqrt(Math.max(0,(w+1)**2-u*u))+1;
      const inner=Math.abs(u)<=w&&y>=sill&&y<=top;
      if(!outer)continue;
      const x=axis==='x'?fixed:mid+u,z=axis==='x'?mid+u:fixed;
      if(inner)put(x,y,z,u===0||y===sill+3?white:'light_gray_stained_glass');
      else put(x,y,z,white);
    }
  }
  for(const sign of [-1,1]){
    for(let x=-34;x<=40;x+=9){
      if(x>=-4&&x<=28)continue;
      box(x,4,sign*26,x,17,sign*26,white);
      box(x-1,4,sign*26,x+1,5,sign*26,white);
      box(x-1,17,sign*26,x+1,18,sign*26,white);
    }
    for(let x=-30;x<=38;x+=9)if(x<-3||x>27){roundWindow('z',sign*25,x,7,2,5);roundWindow('z',sign*n,x,23,1,3);}
    for(const x of [-3,27])for(const z of [sign*20,sign*29]){
      box(x,4,z,x,29,z,white);
      box(x-1,28,z,x+1,30,z,white);
    }
    roundWindow('z',sign*34,12,10,4,9);
  }
  // Cornices follow the real footprint rather than a box around the model.
  for(let x=-39;x<=57;x++)for(let z=-34;z<=34;z++){
    const h=zone(x,z);if(!h)continue;
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])if(zone(x+dx,z+dz)<h){
      for(const [yy,ext]of [[h-2,0],[h,1],[h+1,1]])put(x+dx*ext,yy,z+dz*ext,white);
    }
  }
  // Interior arcades and four crossing piers support the open drum.
  for(const sign of [-1,1]){
    for(let x=-33;x<=40;x+=9)if(x<-3||x>27){
      box(x-1,4,sign*(n-1)-1,x+1,19,sign*(n-1)+1,cream);
      box(x-2,18,sign*(n-1)-1,x+2,19,sign*(n-1)+1,white);
    }
    for(const px of [cx-11,cx+11])box(px-1,4,sign*11-1,px+1,31,sign*11+1,cream);
    for(let x=-38;x<=42;x++)if(x<-3||x>27){
      const u=((x+33)%9+9)%9-4;
      const arch=15+Math.round(Math.sqrt(Math.max(0,16-u*u)));
      for(let y=arch;y<=21;y++)put(x,y,sign*n,cream);
      if(Math.abs(u)<4)clear(x,4,sign*n,x,arch-1,sign*n);
    }
  }
  // A two-order facade: a broad colonnaded lower storey and a temple-front upper storey.
  box(-41,3,-26,-39,22,26,cream);
  box(-41,23,-n-1,-39,37,n+1,cream);
  for(const y of [5,20,21,22])box(-43,y,-27,-39,y,27,y===20?shadow:white);
  for(const y of [35,36,37])box(-43,y,-n-2,-39,y,n+2,y===35?shadow:white);
  function column(x,z,y0,y1){
    y0=Y(y0);y1=Y(y1);const box=rawBox;
    box(x-1,y0,z-1,x+1,y0+1,z+1,white);
    box(x,y0+2,z,x,y1-2,z,'quartz_pillar');
    box(x-1,y1-1,z-1,x+1,y1,z+1,white);
    box(x,y0+2,z-1,x,y1-2,z-1,'quartz_pillar');
    box(x,y0+2,z+1,x,y1-2,z+1,'quartz_pillar');
  }
  for(const z of [-23,-15,-7,7,15,23]){column(-47,z,4,20);column(-42,z,4,20);}
  for(const z of [-n+1,-Math.round((n-1)/2),Math.round((n-1)/2),n-1])column(-43,z,23,35);
  // Portico podium, seven shallow steps and a coffered roof.
  box(-49,0,-27,-39,3,27,base);
  for(let k=0;k<4;k++)box(-53+k,k,-26,-50,k,26,white);
  box(-49,21,-27,-39,22,27,white);
  for(let x=-47;x<=-41;x+=3)for(let z=-22;z<=22;z+=4)put(x,20,z,shadow);
  function pediment(x0,x1,mid,half,y0,rise){
    y0=Y(y0);const box=rawBox;
    for(let u=-half;u<=half;u++){
      const top=y0+Math.round((half-Math.abs(u))*rise/half);
      box(x0,y0,mid+u,x1,top,mid+u,cream);
      box(x0-1,top,mid+u,x1,top,mid+u,white);
      box(x0-1,y0,mid+u,x1,y0+1,mid+u,white);
    }
  }
  pediment(-43,-39,0,n+3,38,8);
  // Symmetrical side aedicules with small pediments, and a deep central entry.
  for(const z of [-19,19]){
    roundWindow('x',-42,z,8,2,5);
    pediment(-43,-41,z,4,16,3);
  }
  roundWindow('x',-42,0,5,3,9);
  clear(-42,4,-3,-38,13,3);
  for(const z of [-3,3])box(-42,4,z,-42,14,z,white);
  roundWindow('x',-42,0,26,3,4);
  // Small balustrades above the wings remain restrained and horizontal.
  for(const sign of [-1,1])for(let z=n+4;z<=26;z++){
    if(z%2===0)box(-41,23,sign*z,-41,24,sign*z,'quartz_pillar');
    put(-41,25,sign*z,white);
  }
  // Transept temple ends echo the west front without Gothic towers or spires.
  for(const sign of [-1,1]){
    for(const px of [0,6,18,24])column(px,sign*35,4,28);
    for(let x=-5;x<=29;x++){
      const top=32+Math.round((17-Math.abs(x-12))*0.42);
      for(let y=31;y<=top;y++)put(x,y,sign*35,cream);
      put(x,top+1,sign*36,white);put(x,31,sign*36,white);
    }
  }
  // Remove the crossing roof: the octagonal drum opens into the interior.
  const oct=(x,z)=>Math.max(Math.abs(x),Math.abs(z),(Math.abs(x)+Math.abs(z))/1.41421356237);
  for(let x=-R;x<=R;x++)for(let z=-R;z<=R;z++)if(oct(x,z)<R-2)clear(cx+x,30,z,cx+x,39,z);
  for(let x=-R-1;x<=R+1;x++)for(let z=-R-1;z<=R+1;z++){
    const d=oct(x,z);if(d>R||d<R-1.5)continue;
    const a=Math.atan2(z,x),face=Math.abs(Math.sin(a*4));
    for(let y=31;y<=42;y++){
      const win=face<0.42&&y>=34&&y<=39;
      put(cx+x,y,z,win?'light_gray_stained_glass':(y<=32||y>=41?white:cream));
    }
  }
  // Tall, hollow octagonal terracotta dome, eight stone ribs and continuous courses.
  for(let y=43;y<=67;y++){
    const t=(y-43)/24, radius=Math.max(0.65,R*Math.pow(Math.cos(t*Math.PI/2),0.78));
    const previous=y===43?R:R*Math.pow(Math.cos(((y-44)/24)*Math.PI/2),0.78);
    const inner=Math.min(radius-1.4,previous-1.4);
    for(let x=-R;x<=R;x++)for(let z=-R;z<=R;z++){
      const d=oct(x,z);if(d>radius||d<Math.max(0,inner))continue;
      const rib=Math.min(Math.abs(x),Math.abs(z),Math.abs(Math.abs(x)-Math.abs(z))/1.414)<0.65;
      put(cx+x,y,z,rib?white:(y%5===0?'bricks':'red_terracotta'));
    }
  }
  // Lantern: octagonal plinth, glazed openings and a compact copper cap.
  for(let y=67;y<=76;y++)for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++){
    const d=oct(x,z);if(d>3)continue;
    if(y<=68||y>=75)put(cx+x,y,z,white);
    else if(d>=2)put(cx+x,y,z,(x===0||z===0)?'light_gray_stained_glass':white);
  }
  for(let y=77;y<=80;y++){
    const r=Math.max(0,3-(y-77));
    for(let x=-r;x<=r;x++)for(let z=-r;z<=r;z++)if(oct(x,z)<=r)put(cx+x,y,z,'waxed_cut_copper');
  }
  box(cx,81,0,cx,84,0,'gold_block');box(cx,83,-1,cx,83,1,'gold_block');
  // A small sanctuary and paired benches give the shell a readable interior.
  if(options.interior!==false){
  box(40,4,-6,48,5,6,white);box(44,6,-3,46,7,3,white);
  for(let x=-29;x<=-7;x+=5)for(const sign of [-1,1])box(x,4,sign<0?-9:5,x+1,5,sign<0?-5:9,'dark_oak_planks');
  }
  // Export contains only the building. The landscape is a separate preview layer.
  M.fixConnections(S);M.stairShapes(S);
  const m=S.toModel(),issues=M.checkPlacement(S);
  return {S,spec:{style:'renaissance',plan:'latin',dome:'octagonal-ribbed',seed:1},report:[
    '文艺复兴式样例：对称双层柱式立面、三角山花、圆拱窗、八角鼓座与红陶肋架穹顶。',
    '独立风格研究，结合古典神庙式立面与意大利穹顶教堂特征，并非某一历史建筑的复刻。',
    `建筑尺寸 ${m.W} × ${m.L} 格；总高 ${m.H} 格；非空气方块 ${S.blocks.size.toLocaleString('en-US')} 个。`
  ],metadata:{width:m.W,height:m.H,length:m.L,blocks:S.blocks.size,placement:issues}};
}

function renaissanceRefined(M, options={}){
 const r=renaissanceShell(M,options),S=r.S,B=M.B,cx=12,R=16;
 const white='smooth_quartz',cream='smooth_sandstone';
 const {half:n,Y}=renaissanceLayout(options);
 const rawPut=(x,y,z,m,p)=>S.set(x,y,z,B(m,p)),rawDel=(x,y,z)=>S.del(x,y,z);
 const rawBox=(x0,y0,z0,x1,y1,z1,m,p)=>{for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)rawPut(x,y,z,m,p);};
 const rawClear=(x0,y0,z0,x1,y1,z1)=>{for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++)rawDel(x,y,z);};
 const put=(x,y,z,m,p)=>rawPut(x,Y(y),z,m,p),del=(x,y,z)=>rawDel(x,Y(y),z);
 const box=(x0,y0,z0,x1,y1,z1,m,p)=>rawBox(x0,Y(y0),z0,x1,Y(y1),z1,m,p);
 const clear=(x0,y0,z0,x1,y1,z1)=>rawClear(x0,Y(y0),z0,x1,Y(y1),z1);
 const slab=(x,y,z,type='bottom')=>put(x,y,z,'smooth_quartz_slab',{type,waterlogged:false});
 const stair=(x,y,z,facing,half='bottom')=>put(x,y,z,'quartz_stairs',{facing,half,shape:'straight',waterlogged:false});
 const oct=(x,z)=>Math.max(Math.abs(x),Math.abs(z),(Math.abs(x)+Math.abs(z))/Math.SQRT2);
 function ring(y,outer,inner,material=white){for(let x=-Math.ceil(outer);x<=outer;x++)for(let z=-Math.ceil(outer);z<=outer;z++)if(oct(x,z)<=outer&&oct(x,z)>=inner)put(cx+x,y,z,material);}
 function column(x,z,y0,y1,upper=false){
  y0=Y(y0);y1=Y(y1);const put=rawPut,box=rawBox,clear=rawClear;
  const slab=(x,y,z,type='bottom')=>put(x,y,z,'smooth_quartz_slab',{type,waterlogged:false});
  const stair=(x,y,z,facing,half='bottom')=>put(x,y,z,'quartz_stairs',{facing,half,shape:'straight',waterlogged:false});
  clear(x-1,y0,z-1,x+1,y1,z+1);
  box(x-1,y0,z-1,x+1,y0,z+1,white);
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
   if(!dx&&!dz)put(x,y0+1,z,'quartz_pillar',{axis:'y'});
   else if(!dx||!dz)stair(x+dx,y0+1,z+dz,dx<0?'east':dx>0?'west':dz<0?'south':'north');
   else slab(x+dx,y0+1,z+dz,'bottom');
  }
  for(let y=y0+2;y<=y1-3;y++){
   // Two-block shafts fit inside the three-block moulded base and retain quartz's
   // vertical grain. Half-grid centring is rounded toward the building's centre.
   const side=Math.abs(z)>=34;
   const xs=side?(x<cx?[0,1]:[-1,0]):[0,1],zs=side?(z<0?[0,1]:[-1,0]):(z<0?[0,1]:[-1,0]);
   for(const dx of xs)for(const dz of zs)put(x+dx,y,z+dz,'quartz_pillar',{axis:'y'});
  }
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(dx||dz)slab(x+dx,y0+2,z+dz,'bottom');
  for(const[dx,dz,f]of [[-1,0,'east'],[1,0,'west'],[0,-1,'south'],[0,1,'north']])stair(x+dx,y1-2,z+dz,f,'top');
  put(x,y1-2,z,upper?'chiseled_quartz_block':white);
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)slab(x+dx,y1-1,z+dz,'top');
  put(x,y1-1,z,white);put(x,y1,z,white);
  if(upper)for(const dz of [-2,2]){stair(x,y1-2,z+dz,dz<0?'south':'north','top');slab(x,y1-1,z+dz,'bottom');}
 }
 for(const z of [-23,-15,-7,7,15,23]){column(-47,z,4,20);column(-42,z,4,20);}
 for(const z of [-n+1,-Math.round((n-1)/2),Math.round((n-1)/2),n-1])column(-43,z,23,35,true);
 for(const sign of [-1,1])for(const x of [0,6,18,24])column(x,sign*35,4,28);
 // Recessed warm frieze, half-height dentils and a thin cap instead of stacked full bars.
 clear(-50,20,-28,-48,22,28);
 for(let x=-49;x<=-39;x++)for(let z=-27;z<=27;z++)slab(x,22,z);
 for(let z=-27;z<=27;z++){
  put(-49,20,z,cream);
  put(-49,21,z,white);
  if(z%3===0)slab(-50,20,z,'top');
  stair(-50,21,z,'east','top');slab(-50,22,z);
 }
 for(const sign of [-1,1])for(let x=-49;x<=-40;x++){
  if(x%3===0)slab(x,20,sign*28,'top');
  stair(x,21,sign*28,sign<0?'south':'north','top');slab(x,22,sign*28);
 }
 // Window jambs project one block; glazing moves one block into straight walls.
 function windowDetail(axis,fixed,mid,sill,w,hh){
  hh=Y(sill+hh)-Y(sill);sill=Y(sill);const put=rawPut;
  const slab=(x,y,z,type='bottom')=>put(x,y,z,'smooth_quartz_slab',{type,waterlogged:false});
  const sign=axis==='x'?-1:Math.sign(fixed),at=(u,n)=>axis==='x'?[fixed+sign*n,mid+u]:[mid+u,fixed+sign*n];
  const inside=(u,y)=>Math.abs(u)<=w&&y>=sill&&y<=sill+hh+Math.floor(Math.sqrt(Math.max(0,w*w-u*u)));
  const outer=(u,y)=>Math.abs(u)<=w+1&&y>=sill-1&&y<=sill+hh+Math.floor(Math.sqrt(Math.max(0,(w+1)**2-u*u)));
  for(let u=-w-1;u<=w+1;u++)for(let y=sill-1;y<=sill+hh+w+2;y++){
   if(!outer(u,y))continue;
   const [x,z]=at(u,0),[ox,oz]=at(u,1),[ix,iz]=at(u,-1);
   if(inside(u,y)){
    rawDel(x,y,z);rawDel(ox,y,oz);
    put(ix,y,iz,u===0||y===sill+3?'quartz_pillar':'light_gray_stained_glass',u===0||y===sill+3?{axis:u===0?'y':axis==='x'?'z':'x'}:undefined);
   }else{
    put(ix,y,iz,white);put(x,y,z,white);
    const frameTop=sill+hh+Math.floor(Math.sqrt(Math.max(0,(w+1)**2-u*u)));
    if(y===frameTop&&y>sill+hh)slab(ox,y,oz);else put(ox,y,oz,white);
   }
  }
  for(let u=-w-1;u<=w+1;u++){const[x,z]=at(u,2);slab(x,sill-1,z);}
  const[kx,kz]=at(0,1);put(kx,sill+hh+w+1,kz,'chiseled_quartz_block');
 }
 for(const sign of [-1,1]){
  for(let x=-30;x<=38;x+=9)if(x<-3||x>27){windowDetail('z',sign*25,x,7,2,5);windowDetail('z',sign*n,x,25,1,1);}
  windowDetail('z',sign*34,12,10,4,9);
 }
 for(const z of [-19,19])windowDetail('x',-42,z,8,2,5);
 windowDetail('x',-42,0,26,3,4);
 // Recessed grand wooden entry, with an operable pair of doors at its foot.
 clear(-44,4,-3,-38,17,3);
 for(let u=-5;u<=5;u++)for(let y=4;y<=Y(19);y++){
  const put=rawPut;
  const inner=Math.abs(u)<=3&&y<=Y(14)+Math.floor(Math.sqrt(Math.max(0,9-u*u)));
  const outer=Math.abs(u)<=4&&y<=Y(14)+Math.floor(Math.sqrt(Math.max(0,16-u*u)))+1;
  if(inner){
   const rail=Math.abs(u)===3||u===0||[4,8,Y(12),Y(16)].includes(y);
   put(rail?-42:-41,y,u,rail?'stripped_spruce_log':'dark_oak_planks',rail?{axis:u===0||Math.abs(u)===3?'y':'z'}:undefined);
   if(rail)put(-41,y,u,'spruce_planks');
  }else if(outer){put(-43,y,u,white);put(-42,y,u,'cut_sandstone');}
 }
 for(const u of [-1,0])for(const half of ['lower','upper']){del(-41,half==='lower'?4:5,u);put(-42,half==='lower'?4:5,u,'dark_oak_door',{facing:'west',half,hinge:u===-1?'left':'right',open:false,powered:false});}
 put(-44,18,0,'chiseled_quartz_block');
 for(const u of [-1,1]){put(-42,9,u,'spruce_planks');put(-43,9,u,'iron_bars',{east:true,west:false,north:false,south:false,waterlogged:false});}
 // Pediments: recessed tympana, a continuous sloping moulding and modest medallions.
 function pedimentDetail(axis,fixed,mid,half,y0,rise){
  y0=Y(y0);const put=rawPut;
  const slab=(x,y,z,type='bottom')=>put(x,y,z,'smooth_quartz_slab',{type,waterlogged:false});
  const stair=(x,y,z,facing,half='bottom')=>put(x,y,z,'quartz_stairs',{facing,half,shape:'straight',waterlogged:false});
  const sign=axis==='x'?-1:Math.sign(fixed),at=(u,n)=>axis==='x'?[fixed+sign*n,mid+u]:[mid+u,fixed+sign*n];
  for(let u=-half;u<=half;u++){
   const top=y0+Math.round((half-Math.abs(u))*rise/half);
   const[x,z]=at(u,0),[ox,oz]=at(u,1),[ix,iz]=at(u,-1);
   for(let y=y0-3;y<=y0;y++){rawDel(x,y,z);rawDel(ox,y,oz);}
   put(x,y0-3,z,white);
   for(let y=y0+2;y<top;y++){rawDel(x,y,z);rawDel(ox,y,oz);put(ix,y,iz,cream);}
   put(x,top,z,white);
   if(u===0)put(ox,top,oz,white);else stair(ox,top,oz,axis==='x'?(u<0?'south':'north'):(u<0?'east':'west'));
   const[px,pz]=at(u,2);
   put(x,y0-2,z,cream);
   if(u%3===0)slab(ox,y0-2,oz,'top');
   stair(ox,y0-1,oz,axis==='x'?'east':sign<0?'south':'north','top');
   slab(px,y0,pz);slab(ox,y0,oz);
  }
  const cy=y0+Math.max(2,Math.round(rise*.45));
  for(let u=-2;u<=2;u++)for(let v=-2;v<=2;v++)if(u*u+v*v<=5){
   const[x,z]=at(u,1),[sx,sz]=at(u,0),edge=u*u+v*v>=2;
   put(sx,cy+v,sz,cream);
   if(!edge){put(sx,cy+v,sz,u===0&&v===0?'chiseled_quartz_block':'cut_sandstone');continue;}
   if(v===2)slab(x,cy+v,z);else if(v===-2)slab(x,cy+v,z,'top');
   else if(Math.abs(u)===2)stair(x,cy+v,z,axis==='x'?(u<0?'south':'north'):(u<0?'east':'west'),v<0?'top':'bottom');
   else put(x,cy+v,z,white);
  }
 }
 pedimentDetail('x',-43,0,n+3,38,8);
 for(const sign of [-1,1])pedimentDetail('z',sign*35,12,17,32,7);
 // Side pilasters and three continuous cornice courses follow the original footprint.
 function zone(x,z){let h=0;if(x>=-39&&x<=43&&Math.abs(z)<=25)h=18;if(x>=-39&&x<=43&&Math.abs(z)<=n)h=30;if(x>=-3&&x<=27&&Math.abs(z)<=34)h=Math.max(h,30);if(x>43&&(x-43)**2+z*z<=196)h=30;return h;}
 for(let x=-38;x<=57;x++)for(let z=-34;z<=34;z++){
  const h=zone(x,z);if(!h)continue;
  for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]])if(zone(x+dx,z+dz)<h){
   put(x,h-2,z,cream);
   if((x+z)%3===0)slab(x+dx,h-2,z+dz,'top');
   stair(x+dx,h-1,z+dz,dx>0?'west':dx<0?'east':dz>0?'north':'south','top');
   slab(x+dx,h,z+dz,'top');slab(x+dx*2,h+1,z+dz*2);
  }
 }
 for(const sign of [-1,1]){
  for(let x=-34;x<=40;x+=9)if(x<-4||x>28){
   box(x-1,3,sign*26,x+1,4,sign*26,white);
   box(x,5,sign*26,x,15,sign*26,'quartz_pillar',{axis:'y'});
   for(const u of [-1,0,1])slab(x+u,16,sign*27,'top');
   put(x,15,sign*27,'chiseled_quartz_block');
  }
 }
 // The same vocabulary continues around the existing semicircular eastern apse.
 const apseCells=[];
 for(let x=44;x<=57;x++)for(let z=-14;z<=14;z++)if(zone(x,z)===30&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dz])=>zone(x+dx,z+dz)===0))apseCells.push([x,z]);
 for(const[x,z]of apseCells){
  const phi=Math.atan2(z,x-43)*180/Math.PI;
  const nearest=[-70,-34,0,34,70].reduce((a,b)=>Math.abs(phi-b)<Math.abs(phi-a)?b:a);
  const u=Math.round(14*(phi-nearest)*Math.PI/180),w=2,sill=8,hh=Y(20)-8;
  const put=rawPut,slab=(x,y,z,type='bottom')=>put(x,y,z,'smooth_quartz_slab',{type,waterlogged:false});
  const inside=Math.abs(u)<=w,yTop=sill+hh+Math.floor(Math.sqrt(Math.max(0,4-u*u)));
  if(Math.abs(u)<=3)for(let y=sill-1;y<=sill+hh+4;y++){
   const frameTop=sill+hh+Math.floor(Math.sqrt(Math.max(0,9-u*u)));
   const outer=y<=frameTop;
   if(!outer)continue;
   const nx=Math.abs(x-43)>=Math.abs(z)?1:0,nz=nx?0:Math.sign(z);
   if(inside&&y>=sill&&y<=yTop)put(x,y,z,'light_gray_stained_glass');
   else{
    put(x,y,z,white);
    if(y===frameTop&&y>sill+hh)slab(x+nx,y,z+nz);
    else if(y===sill-1)slab(x+nx,y,z+nz);
    else put(x+nx,y,z+nz,white);
   }
  }
 }
 for(const angle of [-90,-50,-17,17,50,90]){
  const a=angle*Math.PI/180,x=Math.round(43+14*Math.cos(a)),z=Math.round(14*Math.sin(a));
  box(x-1,0,z-1,x+1,2,z+1,'stone_bricks');box(x-1,3,z-1,x+1,4,z+1,white);
  box(x,5,z,x,26,z,'quartz_pillar',{axis:'y'});
  put(x,27,z,'chiseled_quartz_block');
  for(const[dx,dz,f]of [[-1,0,'east'],[1,0,'west'],[0,-1,'south'],[0,1,'north']])stair(x+dx,28,z+dz,f,'top');
  put(x,28,z,white);
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)slab(x+dx,29,z+dz);
 }
 // A continuous curved skirt replaces the separate projecting feet around the apse.
 for(let x=43;x<=59;x++)for(let z=-16;z<=16;z++){
  const d=Math.hypot(x-43,z);if(d>16||d<13)continue;
  for(let y=0;y<=2;y++)put(x,y,z,'stone_bricks');
  if(d<=15.5)slab(x,3,z);else put(x,3,z,'stone_brick_slab',{type:'bottom',waterlogged:false});
 }
 // Drum corner pilasters sit between eight framed lights, with moulded ring cornices.
 for(let x=-R;x<=R;x++)for(let z=-R;z<=R;z++){
  const d=oct(x,z);if(d>R||d<R-1.5)continue;
  const theta=Math.atan2(z,x),a=Math.round(theta/(Math.PI/4))*Math.PI/4,u=Math.round(-x*Math.sin(a)+z*Math.cos(a));
  for(let y=33;y<=40;y++)if(Math.abs(u)<=3){
   const inner=Math.abs(u)<=2&&y>=34&&y<=37+Math.floor(Math.sqrt(Math.max(0,4-u*u)));
   const outer=y>=33&&y<=37+Math.floor(Math.sqrt(Math.max(0,9-u*u)))+1;
   if(outer){if(inner&&d>15.3)del(cx+x,y,z);else put(cx+x,y,z,inner?'light_gray_stained_glass':white);}
  }
 }
 for(let i=0;i<8;i++){
  const a=(22.5+i*45)*Math.PI/180,len=R/Math.max(Math.abs(Math.cos(a)),Math.abs(Math.sin(a)),(Math.abs(Math.cos(a))+Math.abs(Math.sin(a)))/Math.SQRT2);
  const x=cx+Math.round(len*Math.cos(a)),z=Math.round(len*Math.sin(a));
  for(let y=33;y<=40;y++)put(x,y,z,'quartz_pillar',{axis:'y'});
  slab(x,32,z);slab(x,41,z,'top');
 }
 ring(31,16.5,14.5,cream);ring(32,16.5,14.5);
 ring(41,16.5,14.5,cream);
 for(let x=-17;x<=17;x++)for(let z=-17;z<=17;z++)if(oct(x,z)<=17&&oct(x,z)>=14.5)slab(cx+x,42,z,'top');
 // Quiet the red courses and remove the fragmented v1 white ribs before redrawing them.
 for(const[k,state]of [...S.blocks]){
  const[x,y,z]=M.unkey(k);
  if(y>=Y(43)&&y<=Y(66)&&oct(x-cx,z)<=R+1&&(state==='minecraft:bricks'||state==='minecraft:smooth_quartz'||state==='minecraft:red_terracotta'))rawPut(x,y,z,[Y(50),Y(58)].includes(y)?'bricks':'red_terracotta');
 }
 const ribPaths=[];
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,c=Math.cos(a),s=Math.sin(a),norm=Math.max(Math.abs(c),Math.abs(s),(Math.abs(c)+Math.abs(s))/Math.SQRT2);let previous=null;const path=[];
  for(let y=43;y<=65;y++){
   const t=(y-43)/24,rad=Math.max(.65,R*Math.pow(Math.cos(t*Math.PI/2),.78));
   const point=[cx+Math.round(rad*c/norm),y,Math.round(rad*s/norm)];
   if(previous){
    let x=previous[0],z=previous[2];
    while(x!==point[0]||z!==point[2]){
     const dx=x!==point[0]?Math.sign(point[0]-x):0,dz=dx?0:Math.sign(point[2]-z);
     stair(x,y,z,dx>0?'east':dx<0?'west':dz>0?'south':'north');path.push([x,y,z]);x+=dx;z+=dz;
    }
    put(x,y,z,white);path.push([x,y,z]);
   }else{put(...point,white);path.push(point);}
   previous=point;
  }
  ribPaths.push(path);
 }
 // Stop the ribs at the neck instead of piling eight paths into the centre.
 clear(cx-5,66,-5,cx+5,76,5);
 ring(66,3,0);
 for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++){
  const d=oct(x,z);if(d<=4&&d>3)slab(cx+x,66,z);if(d<=3.5)slab(cx+x,67,z,'top');
 }
 ring(67,2,0);
 for(let x=-3;x<=3;x++)for(let z=-3;z<=3;z++)if(oct(x,z)<=3&&oct(x,z)>=1.6){
  const corner=(Math.abs(x)===3&&Math.abs(z)===1)||(Math.abs(x)===1&&Math.abs(z)===3);
  for(let y=68;y<=74;y++)put(cx+x,y,z,corner?'quartz_pillar':'light_gray_stained_glass',corner?{axis:'y'}:undefined);
 }
 ring(75,3,0);
 for(let x=-4;x<=4;x++)for(let z=-4;z<=4;z++)if(oct(x,z)<=3.7)slab(cx+x,76,z);
 // Half-block roof courses, with stair transitions and a continuous nave/apse seam.
 function roofAt(x,z,height,low,facing,outerHeight){
  height+=Y(30)-30;outerHeight+=Y(30)-30;low=Y(low);const put=rawPut;
  for(let y=low;y<=Y(39);y++){const s=S.get(x,y,z);if(s&&/^minecraft:(bricks|brick_slab|brick_stairs)(\[|$)/.test(s))S.del(x,y,z);}
  const h=Math.round(height*2)/2,top=Math.ceil(h)-1;
  for(let y=low;y<top;y++)put(x,y,z,'bricks');
  if(h%1)put(x,top,z,'brick_slab',{type:'bottom',waterlogged:false});
  else if(outerHeight<h)put(x,top,z,'brick_stairs',{facing,half:'bottom',shape:'straight',waterlogged:false});
  else put(x,top,z,'bricks');
 }
 for(let x=-39;x<=43;x++)for(let z=-34;z<=34;z++){
  if(zone(x,z)!==30||oct(x-cx,z)<=17)continue;
  const nave=Math.abs(z)<=n?32.5+(n-Math.abs(z))/3:-Infinity;
  const tran=x>=-3&&x<=27?32.5+(15-Math.abs(x-cx))/3:-Infinity;
  const h=Math.max(nave,tran);if(!Number.isFinite(h))continue;
  roofAt(x,z,h,31,nave>=tran?(z<0?'south':'north'):(x<cx?'east':'west'),Math.round((h-1/3)*2)/2);
 }
 for(let x=-39;x<=43;x++)for(let z=-25;z<=25;z++)if(zone(x,z)===18){
  const h=20.5+(25-Math.abs(z))/3;
  roofAt(x,z,h,20,z<0?'south':'north',Math.round((h-1/3)*2)/2);
 }
 for(let x=43;x<=57;x++)for(let z=-14;z<=14;z++){
  const d=Math.hypot(x-43,z);if(d>14)continue;
  let h=32+(14-d)*.30;if(x===43&&Math.abs(z)<=n)h=Math.max(h,32.5+(n-Math.abs(z))/3);
  roofAt(x,z,h,31,Math.abs(x-43)>=Math.abs(z)?'west':z<0?'south':'north',Math.round((h-.3)*2)/2);
 }
 M.fixConnections(S);M.stairShapes(S);S.box=null;
 const m=S.toModel(),placement=M.checkPlacement(S);
 return {...r,S,spec:{...r.spec},ribPaths,report:[
  '文艺复兴式：收分柱础、细柱身、上下层差异柱头、薄层檐口、八角纹章、分格木门、细肋穹顶、轻型采光亭与连续后殿基座。',
  '十字平面、六柱门廊、上层四柱、红陶八角穹顶及总高；构件按实际方块尺度制作。',
  `建筑尺寸 ${m.W} × ${m.L} 格；总高 ${m.H} 格；非空气方块 ${S.blocks.size.toLocaleString('en-US')} 个（不含预览广场）。`
 ],metadata:{width:m.W,height:m.H,length:m.L,blocks:S.blocks.size,placement}};
}


const RENAISSANCE_DEFAULT={style:'renaissance',plan:'latin',arch:'round',seed:1,nave_width:27,body_height:27,nave_extra_bays:0,roof:'terracotta',walls:'warm',glass:'gray',interior:true};
function renaissanceCathedral(o={}){
 const adjust=[];
 const integer=(key,lo,hi)=>{const v=o[key]===undefined?RENAISSANCE_DEFAULT[key]:Number(o[key]);const n=Number.isFinite(v)?Math.max(lo,Math.min(hi,Math.round(v))):RENAISSANCE_DEFAULT[key];if(o[key]!==undefined&&Number(o[key])!==n)adjust.push({key,got:n,why:`允许范围 ${lo}–${hi}，取整数`});return n;};
 const choice=(key,allowed)=>{const value=o[key]===undefined?RENAISSANCE_DEFAULT[key]:o[key];if(allowed.includes(value))return value;adjust.push({key,got:RENAISSANCE_DEFAULT[key],why:'采用当前风格支持的材质预设'});return RENAISSANCE_DEFAULT[key];};
 const bool=key=>o[key]===undefined?true:!([false,0,'false','0'].includes(o[key]));
 const layout=renaissanceLayout(o);
 const p={...RENAISSANCE_DEFAULT,type:'cathedral',nave_width:layout.width,body_height:layout.height,nave_extra_bays:integer('nave_extra_bays',0,3),seed:integer('seed',-999999,999999),roof:choice('roof',['terracotta','slate','copper']),walls:choice('walls',['warm','ivory']),glass:choice('glass',['gray','clear','amber','colored']),interior:bool('interior')};
 for(const key of ['nave_width','body_height'])if(o[key]!==undefined&&Number(o[key])!==p[key])adjust.push({key,got:p[key],why:key==='nave_width'?'中殿宽为23–35的奇数':'主体墙高为25–39的整数，自室内地面起计'});
 const r=renaissanceRefined({Structure,B,unkey,fixConnections,stairShapes,checkPlacement},p),S=r.S;
 // Repeat a complete nine-block architectural bay. The facade moves west and
 // the crossing/apse keep their original positions; no raster scaling is used.
 if(p.nave_extra_bays){
  const source=[...S.blocks],out=new Map(),add=p.nave_extra_bays*9;
  for(const[k,v]of source){const[x,y,z]=unkey(k);out.set(key3(x<-25?x-add:x,y,z),v);}
  for(const[k,v]of source){const[x,y,z]=unkey(k);if(x>=-34&&x<=-26)for(let i=0;i<p.nave_extra_bays;i++)out.set(key3(x-9*i,y,z),v);}
  S.blocks=out;
 }
 const roofMaps={slate:{red_terracotta:'deepslate_tiles',bricks:'deepslate_bricks',brick_stairs:'deepslate_tile_stairs',brick_slab:'deepslate_tile_slab',waxed_cut_copper:'deepslate_tiles'},copper:{red_terracotta:'oxidized_copper',bricks:'oxidized_cut_copper',brick_stairs:'oxidized_cut_copper_stairs',brick_slab:'oxidized_cut_copper_slab',waxed_cut_copper:'oxidized_cut_copper'}};
 const salt=(x,y,z)=>{let n=Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791)^Math.imul(p.seed,2654435761);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;};
 const colors=['red','yellow','light_blue','blue','green'];
 for(const[k,state]of S.blocks){
  const name=state.slice(10).split('[')[0],props=state.includes('[')?state.slice(state.indexOf('[')):'';
  let value=state;
  if(p.walls==='ivory'&&name==='smooth_sandstone')value=B('calcite');
  if(p.walls==='ivory'&&name==='cut_sandstone')value=B('polished_diorite');
  const roof=roofMaps[p.roof];if(roof&&roof[name])value='minecraft:'+roof[name]+props;
  if(name==='light_gray_stained_glass'){
   const[x,y,z]=unkey(k),dye=p.glass==='colored'?colors[salt(x,y,z)%colors.length]:p.glass==='amber'?'yellow':p.glass==='gray'?'light_gray':null;
   value=B(dye?dye+'_stained_glass':'glass');
  }
  if(value!==state)S.blocks.set(k,value);
 }
 fixConnections(S);stairShapes(S);S.box=null;
 const [[x0,y0,z0],[x1,y1,z1]]=S.bounds(),placement=checkPlacement(S),W=x1-x0+1,H=y1-y0+1,L=z1-z0+1;
 const report=[`文艺复兴式：中殿新增 ${p.nave_extra_bays} 开间（每间9格）；保留六柱门廊、上层四柱与八角肋架穹顶。`,
  `中殿宽 ${p.nave_width} 格；主体墙高 ${p.body_height} 格（自 y=3 的室内地面起）。祭坛与长椅${p.interior?'开启':'关闭'}。`,
  `屋顶${{terracotta:'红陶与砖',slate:'深板岩',copper:'铜绿'}[p.roof]}；墙体${p.walls==='warm'?'暖色砂岩':'象牙白'}；玻璃${{gray:'淡灰',clear:'透明',amber:'琥珀',colored:'彩色混合'}[p.glass]}。`,
  `总尺寸 ${W}×${L}，高 ${H}；建筑方块 ${S.blocks.size} 个（不含预览地面）。`,
  '宽轴调整中殿宽，竖轴调整主体墙高，长轴增加中殿开间。种子只改变彩色玻璃的配色分布，不改变建筑轮廓。'];
 return {S,spec:p,report,adjust,foot:[x0,x1,z0,z1],tags:['landmark','cathedral','renaissance'],placement,metadata:{width:W,height:H,length:L,blocks:S.blocks.size}};
}
CATHEDRAL_STYLES.renaissance='文艺复兴式';
CATHEDRAL_PRESETS.renaissance=RENAISSANCE_DEFAULT;
