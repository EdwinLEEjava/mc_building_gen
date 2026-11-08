// Shared editor integration for Baroque and Renaissance cathedral styles.
(() => {
  const styles = {
    baroque: { bays: 'extra_bays', per: 14, width: [33,49], height: [32,46], roof: [['copper','铜绿'],['slate','深板岩']], walls: [['sandstone','暖黄砂岩'],['ivory','象牙白']], yaw: -1.04, pitch: .37, distance: 1.95 },
    renaissance: { bays: 'nave_extra_bays', per: 9, width: [23,35], height: [25,39], roof: [['terracotta','红陶与砖'],['slate','深板岩'],['copper','铜绿']], walls: [['warm','暖色砂岩'],['ivory','象牙白']], glass: [['gray','淡灰'],['clear','透明'],['amber','琥珀'],['colored','彩色混合']], yaw: -.95, pitch: .4, distance: 1.8 },
  };
  const fields = [], saved = new Map(), seedTitle = $('c_cd_seed').title;
  const current = () => styles[$('c_cd_style').value];
  const id = (style, key) => 'c_cd_' + style + '_' + key;
  const options = list => list.map(([v,t]) => `<option value="${v}">${t}</option>`).join('');
  let ready = false, lastStyle = '', lastSize = '';
  function restore() {
    for (const [el,state] of saved) { el.hidden=state.hidden; el.style.display=state.display; if ('disabled' in state) el.disabled=state.disabled; }
    saved.clear();
  }
  function hide(el, disable=false) {
    if (!saved.has(el)) saved.set(el,{hidden:el.hidden,display:el.style.display,...('disabled' in el?{disabled:el.disabled}:{})});
    if (disable) el.disabled=true; else { el.hidden=true; el.style.display='none'; }
  }
  function sync() {
    if (!ready) return;
    const style=$('c_cd_style').value, active=styles[style], panel=compPanel('cathedral');
    for (const f of fields) { const show=f.style===style; f.label.hidden=!show; f.label.style.display=show?'':'none'; f.input.disabled=!show; }
    if (!active) { $('c_cd_seed').title=seedTitle; return; }
    for (const el of panel.querySelectorAll('input[id],select[id]')) {
      if (el.id==='c_cd_style'||el.id==='c_cd_seed'||fields.some(f=>f.input===el)) continue;
      hide(el.closest('label')); hide(el,true);
    }
    hide(panel.querySelector('.matbox'));
    for (const group of panel.querySelectorAll('details.grp')) {
      const visible=[...group.querySelectorAll('label')].some(l=>!l.hidden&&l.style.display!=='none');
      if (!visible) hide(group);
    }
    $('c_cd_seed').title=style==='baroque'?'改变浮雕与钟面图案':'改变彩色玻璃的配色分布';
  }
  const baseDeps=syncExtraCathedralDeps, baseFields=syncExtraCathedralFields;
  syncExtraCathedralDeps=function(){restore();baseDeps();sync();};
  syncExtraCathedralFields=function(){restore();baseFields();sync();};
  const baseSpec=compSpec;
  compSpec=function(){
    const c=current();if(ctype!=='cathedral'||!c)return baseSpec();
    const style=$('c_cd_style').value,o={type:'cathedral',style,seed:+val('c_cd_seed')};
    for(const key of [c.bays,'nave_width','body_height','roof','walls','interior',...(c.glass?['glass']:[])])o[key]=[c.bays,'nave_width','body_height'].includes(key)?+val(id(style,key)):val(id(style,key));
    return o;
  };
  const baseAdjust=showAdjust;
  showAdjust=function(panel,prefix,req,res){
    return baseAdjust(panel,req?.type==='cathedral'&&styles[req.style]?'c_cd_'+req.style+'_':prefix,req,res);
  };
  const baseAxes=sizeAxes;
  sizeAxes=function(type){
    const component=curMode()==='comp'&&type===ctype,it=component?null:selItem(),style=component?$('c_cd_style').value:it?.style,c=styles[style];
    return type==='cathedral'&&c?{x:{f:c.bays,id:id(style,c.bays),lab:'新增中殿开间',per:c.per},z:{f:'nave_width',id:id(style,'nave_width'),lab:'中殿宽'},y:{f:'body_height',id:id(style,'body_height'),lab:'主体墙高'}}:baseAxes(type);
  };
  function defaults(style) {
    const c=styles[style],p=MCGen.CATHEDRAL_PRESETS[style];
    for(const key of [c.bays,'nave_width','body_height','roof','walls','interior',...(c.glass?['glass']:[])]){const el=$(id(style,key));if(el.type==='checkbox')el.checked=p[key]!==false;else el.value=p[key];}
  }
  function group(title) {return [...compPanel('cathedral').querySelectorAll('details.grp')].find(g=>g.querySelector('summary').textContent===title).querySelector('.grid');}
  function field(style,key,title,html,target) {
    const lab=document.createElement('label');lab.className=key==='interior'?'ck':'f';lab.hidden=true;
    lab.innerHTML=key==='interior'?html+title:title+html;
    const input=lab.querySelector('input,select');input.id=id(style,key);input.disabled=true;group(target).appendChild(lab);fields.push({style,key,label:lab,input});
  }
  queueMicrotask(()=>{
    for(const [style,c]of Object.entries(styles)){
      if(!$('c_cd_style').querySelector(`[value="${style}"]`))$('c_cd_style').add(new Option(MCGen.CATHEDRAL_STYLES[style],style));
      field(style,c.bays,'新增中殿开间','<input type="number" min="0" max="3" step="1">','平面');
      $(id(style,c.bays)).title=`每增加一开间，长度增加 ${c.per} 格`;
      field(style,'nave_width','中殿宽',`<input type="number" min="${c.width[0]}" max="${c.width[1]}" step="2">`,'平面');
      $(id(style,'nave_width')).title='含两侧墙体的中殿宽度，按对称奇数格调整；侧廊与穹顶保留各自的跨度';
      field(style,'body_height','主体墙高',`<input type="number" min="${c.height[0]}" max="${c.height[1]}" step="1">`,'剖面高度');
      $(id(style,'body_height')).title='从室内地面到中殿墙顶的高度；墙身和柱身随之增减，屋顶与上部构件一起升降';
      field(style,'roof','屋顶',`<select>${options(c.roof)}</select>`,'材质预设');
      field(style,'walls','墙体',`<select>${options(c.walls)}</select>`,'材质预设');
      if(c.glass)field(style,'glass','玻璃',`<select>${options(c.glass)}</select>`,'材质预设');
      field(style,'interior','祭坛与长椅','<input type="checkbox">','室内');defaults(style);
    }
    ready=true;syncExtraCathedralFields();
    const requested=new URLSearchParams(location.search).get('style');
    if(styles[requested]){$('c_cd_style').value=requested;$('c_cd_style').dispatchEvent(new Event('change',{bubbles:true}));setMode('comp');setType('cathedral');}
  });
  document.addEventListener('change',e=>{
    if(e.target.id!=='c_cd_style')return;
    const style=$('c_cd_style').value;if(styles[style])defaults(style);
    syncExtraCathedralFields();
  },true);
  const baseUseAsset=useAsset;
  useAsset=function(asset){
    const it=asset?.item,c=styles[it?.style];
    if(curMode()!=='comp'||it?.type!=='cathedral'||!c)return baseUseAsset(asset);
    const style=it.style;$('c_cd_style').value=style;defaults(style);
    $('c_cd_seed').value=it.seed??MCGen.CATHEDRAL_PRESETS[style].seed;
    for(const key of [c.bays,'nave_width','body_height','roof','walls','interior',...(c.glass?['glass']:[])]){
      if(it[key]===undefined)continue;
      const el=$(id(style,key));if(el.type==='checkbox')el.checked=!!it[key];else el.value=it[key];
    }
    syncExtraCathedralFields();setType('cathedral');
    libSel=asset.id;markSel();
  };
  const baseItemFields=extraCathedralItemFields;
  extraCathedralItemFields=function(it,f,sel,num,ck,styleOptions){
    const c=styles[it.style];if(!c)return baseItemFields(it,f,sel,num,ck,styleOptions);
    const section=(name,content)=>`<details class="grp" open><summary>${name}</summary><div class="grid">${content}</div></details>`;
    let mats=f('屋顶',sel('roof',options(c.roof)))+f('墙体',sel('walls',options(c.walls)));if(c.glass)mats+=f('玻璃',sel('glass',options(c.glass)));
    return section('基本',f('风格',sel('style',styleOptions),true)+f('种子','<input type="number" data-k="seed">'))+section('平面',f('中殿宽',num('nave_width',...c.width).replace('>',' step="2">'))+f('新增中殿开间',num(c.bays,0,3)))+section('剖面高度',f('主体墙高',num('body_height',...c.height)))+section('材质预设',mats)+section('室内',ck('interior','祭坛与长椅'));
  };
  const baseItemRender=renderItemEditor;
  renderItemEditor=function(){baseItemRender();const it=curMode()==='layout'&&!multi()?selItem():null;if(styles[it?.style]){$('itemed').querySelector('[data-k="roof"]').value=it.roof||MCGen.CATHEDRAL_PRESETS[it.style].roof;}};
  const baseEdit=edApply;
  edApply=function(el){
    const it=edFor;if(!it||selItem()!==it||it.type!=='cathedral')return baseEdit(el);
    const key=el.dataset.k,transition=key==='style'&&(styles[it.style]||styles[el.value]);
    if(!transition&&!(styles[it.style]&&key==='roof'))return baseEdit(el);
    if(!edPushed){pushHist();edPushed=true;}
    if(transition){
      const seed=it.seed,next=el.value,keys=new Set(Object.keys(MCGen.CATHEDRAL_DEFAULT));
      for(const preset of Object.values(MCGen.CATHEDRAL_PRESETS))for(const k of Object.keys(preset))keys.add(k);
      for(const k of keys)delete it[k];
      Object.assign(it,styles[next]?MCGen.CATHEDRAL_PRESETS[next]:{...MCGen.CATHEDRAL_DEFAULT,...MCGen.CATHEDRAL_PRESETS[next]},{style:next});
      if(seed!==undefined)it.seed=seed;if(next==='brick_gothic')delete it.tower_top;
      edFor=null;
    }else it.roof=el.value;
    it.manual=true;clearTimeout(edTimer);edTimer=setTimeout(()=>{retouch([it.id],`修改了主教座堂 #${it.id}`,it.id);setTimeout(()=>{edPushed=false;},800);},120);
  };
  const baseExport=exportBase;
  exportBase=function(){const c=styles[curSpec?.style];return c?`mcgen_${curSpec.style}_w${curSpec.nave_width}_h${curSpec.body_height}_bays${curSpec[c.bays]||0}_seed${curSpec.seed??1}`:baseExport();};
  const baseEncode=encodeSchem;
  encodeSchem=function(m){if(curMode()==='comp'&&ctype==='cathedral'&&styles[curSpec?.style]&&m===model){const r=MCGen.cathedral(curSpec);r.S.blocks=MCGen.rotQuarter(r.S.blocks,propRot.cathedral||0);return baseEncode(r.S.toModel());}return baseEncode(m);};
  const baseShow=showModel;
  showModel=function(m,label,spec,report,roles,keepView){
    const c=styles[spec?.style],size=[m.W,m.H,m.L].join(','),reset=c&&(lastStyle!==spec.style||lastSize!==size);
    baseShow(m,label,spec,report,roles,reset?false:keepView);
    if(c&&curMode()==='comp'&&ctype==='cathedral'&&SEL?.kind==='comp')renderSel();
    if(reset){cam.target=[m.W/2,m.H*(spec.style==='baroque'?.42:.41),m.L/2];cam.yaw=c.yaw;cam.pitch=c.pitch;cam.dist=Math.max(m.W,m.H,m.L)*c.distance;redraw();}
    lastStyle=spec?.style||'';lastSize=size;
  };
})();
