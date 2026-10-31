import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from './core.js';
import { segDist, roomD } from './layout.js';

const textures = {};
const sets = { paving:'monastery_stone_floor', earth:'grass_ground', rock:'mossy_rock' };
export async function loadSurfaces() {
  const loader = new THREE.TextureLoader();
  await Promise.all(Object.entries(sets).map(async ([key, name]) => {
    const [map, normalMap, packed] = await Promise.all(['color','normal','arm'].map(s => loader.loadAsync(`assets/surfaces/${name}-${s}.jpg`)));
    map.colorSpace = THREE.SRGBColorSpace;
    for (const t of [map, normalMap, packed]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
    textures[key] = { map, normalMap, roughnessMap:packed, aoMap:packed };
  }));
}

export function surface(key, options = {}) {
  return new THREE.MeshStandardMaterial({ ...textures[key], roughness:1, metalness:0, normalScale:new THREE.Vector2(0.65,0.65), aoMapIntensity:0.8, ...options });
}

export function worldUV(geo, size = 5) {
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i=0; i<p.count; i++) { uv[i*2]=p.getX(i)/size; uv[i*2+1]=-p.getZ(i)/size; }
  geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  return geo;
}

export function foliageGeometry(grass=false) {
  const rand=mulberry32(grass?178:811),parts=[];
  const count=grass?5:48;
  for(let i=0;i<count;i++) {
    const h=grass?.22+rand()*.36:.25+rand()*.5, w=grass?.022+rand()*.025:.09+rand()*.05;
    const positions=[],uv=[];
    for(let s=0;s<=3;s++) {
      const t=s/3,width=Math.sin(Math.PI*t)*w;
      positions.push(-width,t*h,t*t*h*.5,width,t*h,t*t*h*.5);uv.push(0,t,1,t);
    }
    const indices=[];for(let k=0;k<3;k++){const a=k*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
    g.rotateZ((rand()-.5)*(grass?.5:2)).rotateY(rand()*Math.PI*2).translate((rand()-.5)*(grass?.28:1.05),grass?0:rand()*.46,(rand()-.5)*(grass?.28:.95));parts.push(g);
  }
  const result=mergeGeometries(parts);parts.forEach(g=>g.dispose());return result;
}

// A luz de apoio fica gravada em pequenas superfícies. Não há uma luz dinâmica por lanterna.
const softDisc = (() => {
  const c=document.createElement('canvas'); c.width=c.height=64; const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'#fff');g.addColorStop(0.2,'#bbb');g.addColorStop(1,'#000');
  ctx.fillStyle=g;ctx.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);
})();

export function groundLight(group,x,z,r,color=0xffb251) {
  const m=new THREE.MeshBasicMaterial({color,map:softDisc,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0.22});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(r*2,r*2).rotateX(-Math.PI/2),m);
  mesh.position.set(x,0.075,z);group.add(mesh);
}

class Masonry {
  constructor(group) { this.group=group;this.batches=new Map(); }
  add(geo,mat,x,y,z,sx=1,sy=sx,sz=sx,ry=0) {
    const g=geo.index?geo.toNonIndexed():geo.clone();
    g.scale(sx,sy,sz).rotateY(ry).translate(x,y,z);
    const list=this.batches.get(mat) ?? [];list.push(g);this.batches.set(mat,list);
  }
  finish() {
    for(const [mat,parts] of this.batches) {
      const mesh=new THREE.Mesh(mergeGeometries(parts),mat);mesh.castShadow=mesh.receiveShadow=true;this.group.add(mesh);parts.forEach(g=>g.dispose());
    }
  }
}

function block() {
  const shape=new THREE.Shape();shape.moveTo(-.5,-.5);shape.lineTo(.5,-.5);shape.lineTo(.5,.5);shape.lineTo(-.5,.5);shape.closePath();
  return new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:true,bevelSize:.055,bevelThickness:.055,bevelSegments:1,steps:1}).translate(0,0,-.5);
}

export function addPlaza(group) {
  const paving=surface('paving',{color:0xd9d4c3}), stone=surface('rock',{color:0xb8b9a5});
  const floor=new THREE.Mesh(worldUV(new THREE.CircleGeometry(10.7,96).rotateX(-Math.PI/2),4.8),paving);
  floor.position.y=.018;floor.receiveShadow=true;group.add(floor);
  const batch=new Masonry(group), b=block();
  for(let i=0;i<72;i++) {const a=i/72*Math.PI*2;batch.add(b,stone,Math.cos(a)*10.8,-.005,Math.sin(a)*10.8,.91,.13,.38,-a-Math.PI/2);}
  const brass=new THREE.MeshStandardMaterial({color:0x837957,metalness:.5,roughness:.64});
  for(const [a,b] of [[3.2,3.25],[3.42,3.47],[.6,.65]]) {
    const ring=new THREE.Mesh(new THREE.RingGeometry(a,b,96).rotateX(-Math.PI/2),brass);ring.position.y=.027;group.add(ring);
  }
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4; const shape=new THREE.Shape();shape.moveTo(0,2.8);shape.lineTo(.21,.92);shape.lineTo(0,.65);shape.lineTo(-.21,.92);shape.closePath();
    const star=new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI/2),brass);star.rotation.y=a;star.position.y=.028;group.add(star);
  }
  // Duas faixas de pedra integram os serviços à praça sem criar degraus na colisão.
  for(const side of [-1,1]) {
    const geo=new THREE.PlaneGeometry(4.4,5.4).rotateX(-Math.PI/2).translate(side*10.6,.022,-1.5);
    const m=new THREE.Mesh(worldUV(geo,4.8),paving);m.receiveShadow=true;group.add(m);
  }
  batch.finish(); b.dispose();
}

export function addVillageDetails(group) {
  const stone=surface('rock',{color:0xb1ac94}),metal=new THREE.MeshStandardMaterial({color:0x363b38,metalness:.65,roughness:.55});
  const light=new THREE.MeshBasicMaterial({color:new THREE.Color(0xffbd63).multiplyScalar(2.3)});
  const b=block(),batch=new Masonry(group);
  // Muretas baixas e pilares ficam além do raio caminhável da vila.
  for(const side of [-1,1]) for(const z of [-9,0,10]) {
    const x=side*14.9;
    for(let k=0;k<4;k++) batch.add(b,stone,x,.18+k*.31,z,1.05,.28,1.05,k*.03);
    batch.add(b,stone,x,1.4,z,1.24,.16,1.24);
    batch.add(new THREE.CylinderGeometry(.06,.08,.85,8),metal,x,1.9,z);
    batch.add(new THREE.CylinderGeometry(.24,.19,.5,8),light,x,2.36,z);
    batch.add(new THREE.ConeGeometry(.38,.28,8),metal,x,2.74,z);
    for(const dx of [-.22,.22]) for(const dz of [-.22,.22]) batch.add(b,metal,x+dx,2.36,z+dz,.035,.57,.035);
    groundLight(group,x-side*.8,z,3.7);
    for(let k=1;k<4;k++) for(let h=0;h<2;h++) batch.add(b,stone,x,.15+h*.28,z+k*1.05,.57,.25,.95);
  }
  batch.finish();b.dispose();
}

export function addGateArch(group,gz) {
  const stone=surface('rock',{color:0xbfc3b0,normalScale:new THREE.Vector2(.4,.4)}),batch=new Masonry(group),b=block();
  for(const side of [-1,1]) {
    for(let row=0;row<5;row++)batch.add(b,stone,side*3.88,.33+row*.66,gz,.88,.62,1.42);
    batch.add(b,stone,side*3.88,.18,gz,1.45,.34,1.8);
    batch.add(b,stone,side*3.88,3.27,gz,1.3,.22,1.7);
  }
  for(let k=0;k<18;k++) {
    const a=k*Math.PI/18+.007,b=(k+1)*Math.PI/18-.007,s=new THREE.Shape();
    s.absarc(0,3.3,4.35,a,b,false);s.lineTo(Math.cos(b)*3.4,3.3+Math.sin(b)*3.4);s.absarc(0,3.3,3.4,b,a,true);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:1.4,bevelEnabled:true,bevelSize:.035,bevelThickness:.035,bevelSegments:1,steps:1,curveSegments:3}).translate(0,0,-.7);
    batch.add(g,stone,0,0,gz);g.dispose();
  }
  batch.finish();b.dispose();
}

// Lajes em toda a área jogável, que somem em grama perto da borda.
// Malha única por bloco do mapa: as partes fora da câmera são descartadas.
function addPaving(group,zones,land,inGap,color) {
  const paving=surface('paving',{color,vertexColors:true,alphaTest:.45,alphaToCoverage:true});
  const bounds=zones.reduce((o,r)=>{const n=(r.sr??r.r)+3;return [Math.min(o[0],r.cx-n),Math.max(o[1],r.cx+n),Math.min(o[2],r.cz-n),Math.max(o[3],r.cz+n)];},[Infinity,-Infinity,Infinity,-Infinity]);
  const cells=new Map(),step=1.15;
  for(let x=bounds[0];x<bounds[1];x+=step) for(let z=bounds[2];z<bounds[3];z+=step) {
    if(land.sd(x+step/2,z+step/2)>.5 || [[x,z],[x+step,z],[x,z+step],[x+step,z+step],[x+step/2,z+step/2]].some(([a,b])=>inGap?.(a,b))) continue;
    const key=`${Math.floor(x/32)},${Math.floor(z/32)}`,v=cells.get(key)??[];
    v.push(x,.009,z, x,.009,z+step, x+step,.009,z, x+step,.009,z, x,.009,z+step, x+step,.009,z+step);cells.set(key,v);
  }
  for(const vertices of cells.values()) {
    const colors=[];
    for(let i=0;i<vertices.length;i+=3) {
      const x=vertices[i],z=vertices[i+2],wear=Math.sin(x*1.8+Math.sin(z*2.7))*.18;
      colors.push(1,1,1,THREE.MathUtils.clamp((-land.sd(x,z)-.12+wear)/1.4,0,1));
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,4));g.computeVertexNormals();worldUV(g,5.2);
    const m=new THREE.Mesh(g,paving);m.receiveShadow=true;group.add(m);
  }
}

export function addRuinArchitecture(group,zones,paths,land,inGap,seed) {
  const rand=mulberry32(seed^0x726f636b),stone=surface('rock',{color:0xb4bd9f});
  addPaving(group,zones,land,inGap,0xdbdfca);
  const b=block();
  for(const room of zones) {
    const batch=new Masonry(group),r=room.sr??room.r;
    for(let k=0;k<10;k++) {
      const a=k/10*Math.PI*2,x=room.cx+Math.cos(a)*(r+.5),z=room.cz+Math.sin(a)*(r+.5);
      if(paths.some(p=>segDist(x,z,p)<p.w/2+2.5) || zones.some(other=>other!==room&&roomD(other,x,z)<2))continue;
      const h=1.4+rand()*2.6;
      batch.add(b,stone,x,.2,z,1.55,.36,1.55,a);
      batch.add(new THREE.CylinderGeometry(.44,.56,h,12),stone,x,h/2+.4,z);
      batch.add(b,stone,x,h+.45,z,1.3,.22,1.3,a);
      for(let j=0;j<4;j++) {
        const angle=a+(j+1)*.09,xx=room.cx+Math.cos(angle)*(r+.6),zz=room.cz+Math.sin(angle)*(r+.6);
        if(paths.some(p=>segDist(xx,zz,p)<p.w/2+2))continue;
        const top=j===3?1:2;
        for(let l=0;l<top;l++)batch.add(b,stone,xx,.22+l*.43,zz,.9,.4,.65,-angle+Math.PI/2);
      }
      if(k%3===0) {
        const m=new THREE.MeshBasicMaterial({color:new THREE.Color(0xffa444).multiplyScalar(2.7)});
        batch.add(new THREE.ConeGeometry(.25,.85,8),m,x,h+1,z);
        groundLight(group,x-Math.cos(a)*1.4,z-Math.sin(a)*1.4,4.2);
      }
    }
    batch.finish();
  }
  b.dispose();
}

// Instâncias agrupadas por bloco do mapa (a câmera descarta os blocos fora de vista).
function scatterMesh(group,geo,material,items,shadow=false) {
  const cells=new Map(),dummy=new THREE.Object3D(),col=new THREE.Color();
  for(const it of items){const k=`${Math.floor(it.x/40)},${Math.floor(it.z/40)}`;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(it);}
  for(const list of cells.values()) {
    const mesh=new THREE.InstancedMesh(geo,material,list.length);
    list.forEach((it,i)=>{dummy.position.set(it.x,it.y,it.z);dummy.rotation.set(0,it.ry??0,it.rz??0);dummy.scale.set(it.s,it.sy??it.s,it.sz??it.s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(it.c!==undefined)mesh.setColorAt(i,col.set(it.c));});
    mesh.castShadow=shadow;mesh.receiveShadow=true;group.add(mesh);
  }
}

const lathe=(pts,seg=28)=>new THREE.LatheGeometry(pts.map(([r,y])=>new THREE.Vector2(r,y)),seg);

// Ponto livre perto de uma sala: anda do centro para fora até sair da área jogável com folga.
function findSpots(land,inGap,rand) {
  const free=(x,z,r)=>[0,1,2,3,4,5].every(k=>land.sd(x+Math.cos(k*1.05)*r,z+Math.sin(k*1.05)*r)>.7)&&!inGap?.(x,z);
  return (room,clear,n)=>{
    const out=[],a0=rand()*6.28;
    for(let k=0;k<16&&out.length<n;k++) {
      const a=a0+k/16*Math.PI*2;
      for(let d=4;d<(room.sr??room.r)+18;d+=.6) {
        const x=room.cx+Math.cos(a)*d,z=room.cz+Math.sin(a)*d;
        if(land.sd(x,z)<clear)continue;
        if(free(x,z,clear-.4)&&out.every(o=>Math.hypot(o.x-x,o.z-z)>8))out.push({x,z,a});
        break;
      }
    }
    return out;
  };
}

// Jardim do Crepúsculo: lajes, sebes crescidas com flores, lanternas, estátuas, fontes, pérgolas e um gazebo.
// Tudo fica fora da área jogável: a colisão e os desafios continuam os mesmos.
// edges: pontos logo fora da borda (sebe baixa) e um pouco mais longe (sebe alta), vindos do world.js.
export function addGardenArchitecture(group,zones,paths,land,inGap,seed,edges) {
  const rand=mulberry32(seed^0x67617264),pick=a=>a[Math.floor(rand()*a.length)];
  addPaving(group,zones,land,inGap,0xeae0dc);
  const stone=surface('rock',{color:0xc4b9b4,normalScale:new THREE.Vector2(.45,.45)}),marble=surface('paving',{color:0xe2d8d2,normalScale:new THREE.Vector2(.3,.3)});
  const metal=new THREE.MeshStandardMaterial({color:0x2f2a30,metalness:.65,roughness:.5});
  const flame=new THREE.MeshBasicMaterial({color:new THREE.Color(0xffb35c).multiplyScalar(2.4)});
  const water=new THREE.MeshStandardMaterial({color:0x6c86c8,roughness:.05,metalness:.4,emissive:0x2a1a40,emissiveIntensity:.5});
  const batch=new Masonry(group),b=block();

  // Sebes: bolhas lisas e sobrepostas com textura de folhagem; a fileira de trás é mais alta.
  const hedgeGeo=new THREE.SphereGeometry(1,16,10),uv=hedgeGeo.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*4,uv.getY(i)*2);
  const hedgeM=surface('earth',{color:0xffffff,normalScale:new THREE.Vector2(1.2,1.2)}),hedges=[],flowers=[];
  const greens=[0xb4d888,0x9cc87a,0xbcd08a,0xa4c482];
  // Nichos: a sebe abre espaço em volta de estátuas, fontes e do gazebo, que ficam à vista da sala.
  const alcoves=[],hedgeAt=()=>{
  for(const [row,list] of [[0,edges.inner],[1,edges.outer]]) for(const p of list) {
    if(inGap?.(p.x,p.z)||rand()<(row?.12:.05)||alcoves.some(a=>Math.hypot(a.x-p.x,a.z-p.z)<a.r))continue;
    const y=land.height(p.x,p.z),s=(row?1.25:1)+rand()*.3,sy=(row?1.3:.9)+rand()*.35;
    hedges.push({x:p.x+(rand()-.5)*.3,y:y+sy*.5,z:p.z+(rand()-.5)*.3,s:s*1.45,sy,sz:s*.85,ry:p.ry+(rand()-.5)*.25,c:new THREE.Color(pick(greens)).multiplyScalar(.85+rand()*.3).getHex()});
    if(rand()<(row?.2:.25))flowers.push({x:p.x+(rand()-.5)*.6,y:y+sy*1.05,z:p.z+(rand()-.5)*.6,s:.55+rand()*.3,ry:rand()*6.28,c:pick([0xff8fc4,0xffa65e,0xc4a2ff,0xfff2e6,0xff7aa0])});
  }
  scatterMesh(group,hedgeGeo,hedgeM,hedges);
  scatterMesh(group,foliageGeometry(),new THREE.MeshStandardMaterial({roughness:.75,side:THREE.DoubleSide}),flowers);
  };

  // Lanternas de ferro ao longo da borda, com a luz pintada no chão.
  edges.inner.filter((p,i)=>i%11===5&&!inGap?.(p.x,p.z)).forEach(p=>{
    const y=land.height(p.x,p.z);
    batch.add(b,stone,p.x,y+.15,p.z,.5,.3,.5);
    batch.add(new THREE.CylinderGeometry(.06,.08,2.1,10),metal,p.x,y+1.3,p.z);
    batch.add(new THREE.CylinderGeometry(.2,.16,.42,12),flame,p.x,y+2.55,p.z);
    batch.add(new THREE.ConeGeometry(.33,.26,12),metal,p.x,y+2.9,p.z);
    groundLight(group,p.x,p.z,3.4);
  });

  const spotsNear=findSpots(land,inGap,rand);
  const statue=(x,z,ry)=>{
    const y=land.height(x,z);
    batch.add(b,stone,x,y+.3,z,1.5,.6,1.5,ry);batch.add(b,stone,x,y+.75,z,1.15,.3,1.15,ry);
    const robe=lathe([[0,0],[.55,0],[.5,.5],[.38,1.3],[.3,1.75],[.2,1.95],[0,2]]);batch.add(robe,marble,x,y+.9,z);robe.dispose();
    const head=new THREE.SphereGeometry(.24,18,12);batch.add(head,marble,x,y+3.05,z);head.dispose();
    const hood=lathe([[0,.62],[.2,.55],[.3,.3],[.27,0],[0,0]],20);batch.add(hood,marble,x,y+2.82,z);hood.dispose();
  };
  const fountain=(x,z)=>{
    const y=land.height(x,z);
    const basin=lathe([[1.9,0],[2.05,.1],[2.05,.55],[1.85,.62],[1.75,.3],[0,.3]],40);batch.add(basin,stone,x,y,z);basin.dispose();
    const col=lathe([[.42,0],[.3,.25],[.24,1.1],[.3,1.25],[0,1.25]],24);batch.add(col,marble,x,y+.3,z);col.dispose();
    const bowl=lathe([[0,0],[.3,0],[.85,.32],[.95,.42],[.82,.42],[0,.2]],32);batch.add(bowl,marble,x,y+1.5,z);bowl.dispose();
    const tip=lathe([[.14,0],[.1,.4],[.18,.5],[0,.62]],16);batch.add(tip,marble,x,y+1.85,z);tip.dispose();
    const pool=new THREE.CircleGeometry(1.78,40).rotateX(-Math.PI/2);batch.add(pool,water,x,y+.5,z);pool.dispose();
    const top=new THREE.CircleGeometry(.8,28).rotateX(-Math.PI/2);batch.add(top,water,x,y+1.86,z);top.dispose();
  };
  for(const [i,room] of zones.entries()) {
    if(room.kind==='start')continue;
    const spots=spotsNear(room,2.3,room.kind==='boss'?4:2);
    spots.forEach((p,k)=>{ const f=k===0&&(i%2===1||room.kind==='boss'); if(f)fountain(p.x,p.z); else statue(p.x,p.z,-p.a+Math.PI/2); alcoves.push({x:p.x,z:p.z,r:f?3.6:2.4}); });
  }

  // Gazebo ao lado do acampamento: oito colunas, cúpula lisa e piso de mármore.
  const g=spotsNear(zones[0],3.6,1)[0];
  if(g) {
    alcoves.push({x:g.x,z:g.z,r:4.6});
    const y=land.height(g.x,g.z),floor=lathe([[2.9,0],[2.9,.25],[0,.25]],8);batch.add(floor,marble,g.x,y,g.z);floor.dispose();
    for(let k=0;k<8;k++){const a=k*Math.PI/4,cx=g.x+Math.cos(a)*2.45,cz=g.z+Math.sin(a)*2.45;const c=new THREE.CylinderGeometry(.16,.19,3,14);batch.add(c,marble,cx,y+1.75,cz);c.dispose();}
    const ring=new THREE.TorusGeometry(2.45,.16,10,48).rotateX(Math.PI/2);batch.add(ring,marble,g.x,y+3.3,g.z);ring.dispose();
    const dome=lathe([[3,0],[2.7,.45],[2,1.05],[1,1.55],[.15,1.8],[.12,2.2],[0,2.25]],40);batch.add(dome,stone,g.x,y+3.3,g.z);dome.dispose();
    groundLight(group,g.x,g.z,4.2,0xffa86a);
  }

  // Pérgolas nos corredores livres (sem desafio): pares de colunas e vigas cobertas de trepadeira.
  const vines=[];
  for(const p of paths) {
    if(!p.main||p.ch)continue;
    const len=Math.hypot(p.bx-p.ax,p.bz-p.az);if(len<7)continue;
    const dx=(p.bx-p.ax)/len,dz=(p.bz-p.az)/len,o=p.w/2+.6,ry=Math.atan2(dx,dz);
    // Só no trecho entre salas: dentro da arena a pérgola atrapalharia a visão da luta.
    if([-3.6,0,3.6].some(u=>{const x=p.ax+dx*(len/2+u),z=p.az+dz*(len/2+u);return zones.some(r=>roomD(r,x,z)<p.w/2+1.5);}))continue;
    for(let t=len/2-3;t<=len/2+3.1;t+=3) {
      const cx=p.ax+dx*t,cz=p.az+dz*t;
      if(inGap?.(cx,cz))continue;
      for(const sg of [-1,1]){const x=cx+dz*o*sg,z=cz-dx*o*sg,c=new THREE.CylinderGeometry(.17,.2,3.4,14);batch.add(c,marble,x,land.height(x,z)+1.7,z);c.dispose();}
      batch.add(b,stone,cx,3.5,cz,o*2+.8,.22,.32,ry);
      for(let k=0;k<4;k++){const u=(k/3-.5)*o*2;vines.push({x:cx+dz*u,y:3.55,z:cz-dx*u,s:.8+rand()*.3,ry:rand()*6.28,rz:Math.PI,c:pick([0x7f9f62,0x8baf6a,0x7f9f62,0xff9cc8])});}
    }
    const mx=p.ax+dx*len/2,mz=p.az+dz*len/2;
    if(!inGap?.(mx,mz))for(const sg of [-1,1])batch.add(b,stone,mx+dz*o*sg,3.72,mz-dx*o*sg,.26,.18,6.8,ry);
  }
  scatterMesh(group,foliageGeometry(),new THREE.MeshStandardMaterial({roughness:.8,side:THREE.DoubleSide}),vines);
  hedgeAt();
  batch.finish();b.dispose();
}

// Obstáculo das arenas no jardim: canteiro de pedra redondo com um arbusto podado em cima.
export function gardenPlanter(radius) {
  const r=radius,pot=lathe([[r*1.02,0],[r*1.08,.12],[r*1.08,.62],[r*.98,.72],[r*.92,.5],[0,.5]],32),bush=new THREE.SphereGeometry(1,20,14).scale(r*.92,r*.75,r*.92).translate(0,.55+r*.45,0);
  return { pot, bush };
}

const glowM=(hex,k)=>new THREE.MeshBasicMaterial({color:new THREE.Color(hex).multiplyScalar(k)});
const rockBlob=()=>new THREE.IcosahedronGeometry(1,3).scale(1,.72,.86);
// Elos de corrente pendurados (alternando o plano do elo).
function chain(batch,mat,x,top,z,n) {
  for(let k=0;k<n;k++){const g=new THREE.TorusGeometry(.13,.035,8,14).scale(1,1.45,1).rotateY(k%2?Math.PI/2:0);batch.add(g,mat,x,top-k*.33,z);g.dispose();}
}

// Forja de Cinzas: muros de basalto, canais de lava fora da arena, fornalhas, bigornas, correntes e carrinhos de minério.
// Tudo fica fora da área jogável; as poças de lava do desafio continuam as únicas na arena.
export function addForgeArchitecture(group,zones,paths,land,inGap,seed,edges) {
  const rand=mulberry32(seed^0x666f7267);
  addPaving(group,zones,land,inGap,0xb8aca4);
  const basalt=surface('rock',{color:0x746a66,normalScale:new THREE.Vector2(.8,.8)}),slab=surface('paving',{color:0x6e6460});
  const iron=new THREE.MeshStandardMaterial({color:0x2c2827,metalness:.75,roughness:.42}),wood=new THREE.MeshStandardMaterial({color:0x4a3222,roughness:.85});
  const lava=glowM(0xff5a12,1.45),fire=glowM(0xff4a10,1.35),ore=new THREE.MeshStandardMaterial({color:0x8a5a40,roughness:.6,emissive:0xff5a10,emissiveIntensity:.35});
  const batch=new Masonry(group),b=block(),spotsNear=findSpots(land,inGap,rand);

  // Muro baixo de blocos de basalto na borda; nas falhas, uma fenda de lava brilha no chão.
  edges.inner.forEach((p,i)=>{
    if(inGap?.(p.x,p.z))return;
    const y=land.height(p.x,p.z);
    if(rand()<.12){batch.add(b,lava,p.x,y+.03,p.z,1.3,.04,.14,p.ry+(rand()-.5)*.6);return;}
    const h=1+Math.floor(rand()*3);
    for(let k=0;k<h;k++)batch.add(b,basalt,p.x+(rand()-.5)*.12,y+.28+k*.52,p.z+(rand()-.5)*.12,1.55,.5,.95,p.ry+(rand()-.5)*.08);
    // Pilares de basalto com braseiro e corrente pendurada.
    if(i%10===4) {
      const c=new THREE.CylinderGeometry(.55,.65,4.4,18);batch.add(c,basalt,p.x,y+2.2,p.z);c.dispose();
      const bowl=lathe([[.2,0],[.7,.3],[.78,.55],[0,.4]],24);batch.add(bowl,iron,p.x,y+4.4,p.z);bowl.dispose();
      const fl=lathe([[.42,0],[.36,.3],[.2,.75],[0,1.25]],18);batch.add(fl,fire,p.x,y+4.62,p.z);fl.dispose();
      chain(batch,iron,p.x+Math.sin(p.ry)*.62,y+4.1,p.z+Math.cos(p.ry)*.62,7);
      groundLight(group,p.x,p.z,4.6,0xff7a30);
    }
  });
  // Canais de lava contínuos atrás do muro.
  edges.outer.forEach((p,i)=>{
    if(inGap?.(p.x,p.z)||rand()<.15)return;
    batch.add(b,lava,p.x,land.height(p.x,p.z)+.05,p.z,2.1,.05,.42,p.ry);
    if(i%6===0)groundLight(group,p.x,p.z,3.2,0xff5a1a);
  });

  const furnace=(x,z,ry)=>{
    const y=land.height(x,z);
    batch.add(b,basalt,x,y+.9,z,2.6,1.8,2.1,ry);batch.add(b,slab,x,y+1.95,z,2.9,.3,2.4,ry);
    const ch=new THREE.CylinderGeometry(.45,.6,3,18);batch.add(ch,basalt,x-Math.cos(ry)*.7,y+3.5,z+Math.sin(ry)*.7);ch.dispose();
    const mx=x+Math.sin(ry)*1.06,mz=z+Math.cos(ry)*1.06;
    batch.add(b,fire,mx,y+.75,mz,1.2,.9,.06,ry);
    groundLight(group,mx+Math.sin(ry)*1.4,mz+Math.cos(ry)*1.4,4.8,0xff8a30);
    // Bigorna ao lado.
    const ax=x+Math.cos(ry)*2.4,az=z-Math.sin(ry)*2.4;
    batch.add(b,iron,ax,y+.25,az,.8,.5,.55,ry);batch.add(b,iron,ax,y+.62,az,.42,.3,.32,ry);batch.add(b,iron,ax,y+.9,az,1.2,.26,.48,ry);
    const horn=new THREE.ConeGeometry(.17,.55,16).rotateZ(-Math.PI/2).translate(.85,0,0);batch.add(horn,iron,ax,y+.9,az,1,1,1,ry);horn.dispose();
  };
  const cart=(x,z,ry)=>{
    const y=land.height(x,z);
    batch.add(b,wood,x,y+.85,z,1.5,.7,.95,ry);batch.add(b,iron,x,y+1.22,z,1.6,.08,1.05,ry);
    for(const sx of [-.55,.55])for(const sz of [-.5,.5]){const w=new THREE.CylinderGeometry(.3,.3,.1,20).rotateX(Math.PI/2).rotateY(Math.PI/2);batch.add(w,iron,x+Math.cos(ry)*sx+Math.sin(ry)*sz,y+.32,z-Math.sin(ry)*sx+Math.cos(ry)*sz,1,1,1,ry);w.dispose();}
    for(let k=0;k<5;k++){const r=rockBlob();batch.add(r,ore,x+(rand()-.5)*.8,y+1.25,z+(rand()-.5)*.5,.28+rand()*.15);r.dispose();}
  };
  for(const room of zones) {
    if(room.kind==='start')continue;
    // A frente da fornalha olha para o centro da sala. group.userData.spots: pontos para conferir o cenário no navegador.
    spotsNear(room,3,2).forEach((p,k)=>{(group.userData.spots??=[]).push(p);const ry=Math.atan2(-Math.cos(p.a),-Math.sin(p.a));if(k===0)furnace(p.x,p.z,ry);else cart(p.x,p.z,ry);});
  }
  batch.finish();b.dispose();
}

// Cidadela do Vazio: mármore escuro rachado, obsidiana polida, pilares e arcos quebrados, destroços flutuando
// e runas discretas (roxo e verde-água) na base dos pilares. Sem anéis brilhando.
export function addVoidArchitecture(group,zones,paths,land,inGap,seed,edges) {
  const rand=mulberry32(seed^0x766f6964),pick=a=>a[Math.floor(rand()*a.length)];
  addPaving(group,zones,land,inGap,0xaaa4c4);
  const marble=surface('paving',{color:0x7a7494,normalScale:new THREE.Vector2(.5,.5)}),stone=surface('rock',{color:0x5c5874});
  const obsidian=new THREE.MeshStandardMaterial({color:0x16121f,roughness:.16,metalness:.4});
  const runes=[glowM(0xa070ff,1.5),glowM(0x3fe0d0,1.3)];
  const batch=new Masonry(group),b=block(),spotsNear=findSpots(land,inGap,rand);
  const glyph=(x,y,z,ry)=>{const g=new THREE.PlaneGeometry(.42,.42);batch.add(g,pick(runes),x,y,z,1,1,1,ry);g.dispose();};

  // Balaustrada baixa e pilares partidos na borda.
  edges.inner.forEach((p,i)=>{
    if(inGap?.(p.x,p.z))return;
    const y=land.height(p.x,p.z);
    if(rand()<.2)return;
    batch.add(b,marble,p.x,y+.2,p.z,1.5,.4,.6,p.ry);
    if(i%7===3) {
      const h=1.2+rand()*3.6,c=new THREE.CylinderGeometry(.42,.48,h,20);
      batch.add(b,obsidian,p.x,y+.3,p.z,1.2,.6,1.2,p.ry);batch.add(c,marble,p.x,y+.6+h/2,p.z);c.dispose();
      if(h>3)batch.add(b,marble,p.x,y+.75+h,p.z,1.05,.25,1.05,p.ry+.2);
      // Runa na base, virada para a sala.
      const fx=Math.sin(p.ry),fz=Math.cos(p.ry),side=land.sd(p.x+fx,p.z+fz)<land.sd(p.x,p.z)?1:-1;
      glyph(p.x+fx*.62*side,y+.32,p.z+fz*.62*side,p.ry+(side<0?Math.PI:0));
    }
  });
  // Arco quebrado perto de cada sala: dois pilares e metade da volta.
  const arch=(x,z,ry)=>{
    const y=land.height(x,z),ox=Math.cos(ry),oz=-Math.sin(ry);
    if([-1,1].some(sg=>land.sd(x+ox*2.2*sg,z+oz*2.2*sg)<1.2))return false; // pilar nunca na área jogável
    for(const sg of [-1,1]){const c=new THREE.CylinderGeometry(.38,.44,3.6,20);batch.add(c,marble,x+ox*2.2*sg,y+1.8,z+oz*2.2*sg);c.dispose();batch.add(b,obsidian,x+ox*2.2*sg,y+.2,z+oz*2.2*sg,1.1,.4,1.1,ry);}
    for(let k=0;k<11;k++) {
      const a=k*Math.PI/18+.01,a2=(k+1)*Math.PI/18-.01,s=new THREE.Shape();
      s.absarc(0,0,2.65,a,a2,false);s.lineTo(Math.cos(a2)*1.85,Math.sin(a2)*1.85);s.absarc(0,0,1.85,a2,a,true);s.closePath();
      const g=new THREE.ExtrudeGeometry(s,{depth:.7,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,bevelSegments:1,curveSegments:3}).translate(0,0,-.35).translate(0,3.6,0);
      batch.add(g,marble,x,y,z,1,1,1,ry);g.dispose();
    }
    glyph(x,y+.45,z,ry);
    return true;
  };
  for(const room of zones) spotsNear(room,3.2,room.kind==='boss'?2:1).forEach(p=>arch(p.x,p.z,Math.atan2(-Math.cos(p.a),-Math.sin(p.a)))&&(group.userData.spots??=[]).push(p));

  // Destroços flutuando acima do abismo, perto da borda.
  const debris=[];
  for(const p of edges.outer.filter((p,i)=>i%3===0)) {
    const x=p.x+(rand()-.5)*16,z=p.z+(rand()-.5)*16;
    if(land.sd(x,z)<5)continue;
    debris.push({x,y:land.height(x,z)+3+rand()*7,z,s:.5+rand()*1.4,sy:.35+rand()*.5,sz:.6+rand()*1,ry:rand()*6.28,rz:(rand()-.5)*.8,c:pick([0x6a6484,0x58526e,0x7a7494])});
  }
  scatterMesh(group,rockBlob(),surface('rock',{color:0xffffff}),debris,true);
  batch.finish();b.dispose();
}

// Cemitério Sombrio: lajes com musgo, muro baixo de pedra com grade de ferro, lápides e cruzes tortas,
// mausoléus, árvores mortas e lanternas de vela. Luar frio contra velas quentes; o verde fica só no veneno.
export function addGraveArchitecture(group,zones,paths,land,inGap,seed,edges) {
  const rand=mulberry32(seed^0x67726176);
  addPaving(group,zones,land,inGap,0xa4ac9e);
  const stone=surface('rock',{color:0x8a8a94,normalScale:new THREE.Vector2(.6,.6)}),slab=surface('paving',{color:0x7c7a86});
  const iron=new THREE.MeshStandardMaterial({color:0x1c1c22,metalness:.7,roughness:.45}),bark=surface('rock',{color:0x4a4240});
  const candle=glowM(0xffb060,1.7),dark=new THREE.MeshBasicMaterial({color:0x06060a});
  const batch=new Masonry(group),b=block(),spotsNear=findSpots(land,inGap,rand);
  const bar=new THREE.CylinderGeometry(.03,.03,1.1,6,1,true),tip=new THREE.ConeGeometry(.06,.18,6);

  // Muro baixo com grade de ferro; um poste de pedra com lanterna de vez em quando.
  edges.inner.forEach((p,i)=>{
    if(inGap?.(p.x,p.z)||rand()<.12)return;
    const y=land.height(p.x,p.z),cx=Math.cos(p.ry),cz=-Math.sin(p.ry);
    if(i%12===6) {
      batch.add(b,stone,p.x,y+.8,p.z,.5,1.6,.5,p.ry);batch.add(b,slab,p.x,y+1.65,p.z,.62,.1,.62,p.ry);
      batch.add(b,iron,p.x,y+1.92,p.z,.3,.42,.3,p.ry);batch.add(b,candle,p.x,y+1.92,p.z,.18,.3,.32,p.ry);
      groundLight(group,p.x,p.z,4.4,0xffa050);return;
    }
    if(rand()<.3){batch.add(b,stone,p.x,y+.2+rand()*.15,p.z,1.5,.5+rand()*.3,.5,p.ry+(rand()-.5)*.1);return;}
    batch.add(b,stone,p.x,y+.25,p.z,1.5,.5,.5,p.ry);
    for(const o of [-.56,-.19,.19,.56]){batch.add(bar,iron,p.x+cx*o,y+1.05,p.z+cz*o);batch.add(tip,iron,p.x+cx*o,y+1.67,p.z+cz*o);}
    batch.add(b,iron,p.x,y+1.45,p.z,1.5,.05,.05,p.ry);
  });

  // Lápides, cruzes e tampas de cova em fileiras tortas fora da área jogável.
  const tablet=(()=>{const s=new THREE.Shape();s.moveTo(-.4,0);s.lineTo(.4,0);s.lineTo(.4,.9);s.absarc(0,.9,.4,0,Math.PI,false);s.lineTo(-.4,0);
    return new THREE.ExtrudeGeometry(s,{depth:.16,bevelEnabled:true,bevelSize:.03,bevelThickness:.03,bevelSegments:2,curveSegments:12}).translate(0,0,-.08);})();
  const cross=mergeGeometries([b.clone().scale(.16,1.5,.14).translate(0,.75,0),b.clone().scale(.75,.16,.14).translate(0,1.1,0)]);
  const lid=b.clone().scale(1,.2,2).translate(0,.1,0),graves=[[],[],[]];
  for(const p of edges.outer) for(let k=0;k<2;k++) {
    const x=p.x+(rand()-.5)*5,z=p.z+(rand()-.5)*5,d=land.sd(x,z);
    if(d<1.8||d>9||inGap?.(x,z)||rand()<.35)continue;
    const t=rand()<.55?0:rand()<.6?1:2;
    graves[t].push({x,y:land.height(x,z)-.05,z,s:.85+rand()*.45,ry:p.ry+(rand()-.5)*.3,rz:t<2?(rand()-.5)*.3:0,c:new THREE.Color(0x9a9aa4).multiplyScalar(.75+rand()*.4).getHex()});
  }
  const graveM=surface('rock',{color:0xffffff,normalScale:new THREE.Vector2(.5,.5)});
  [tablet,cross,lid].forEach((g,t)=>scatterMesh(group,g,graveM,graves[t],t<2));

  // Árvores mortas, tortas e sem folha.
  const tree=(x,z)=>{
    const y=land.height(x,z),h=4+rand()*2.5;
    const trunk=lathe([[.45,0],[.32,.5],[.22,h*.55],[.12,h],[0,h+.2]],14).rotateZ((rand()-.5)*.2);batch.add(trunk,bark,x,y-.1,z,1,1,1,rand()*6.28);trunk.dispose();
    for(let k=0;k<5;k++){const l=1.2+rand()*1.6,g=new THREE.CylinderGeometry(.03,.1,l,8).translate(0,l/2,0).rotateZ(.6+rand()*.6).rotateY(k*1.3+rand()).translate(0,h*(.45+k*.1),0);batch.add(g,bark,x,y,z);g.dispose();}
  };
  edges.outer.forEach((p,i)=>{if(i%23!==11)return;const a=rand()*6.28,x=p.x+Math.cos(a)*4,z=p.z+Math.sin(a)*4;if(land.sd(x,z)>3.5&&!inGap?.(x,z))tree(x,z);});

  // Mausoléu com colunas e porta escura, virado para a sala; uma vela acesa na porta.
  const roof=(()=>{const s=new THREE.Shape();s.moveTo(-1.9,0);s.lineTo(1.9,0);s.lineTo(0,1.2);s.closePath();
    return new THREE.ExtrudeGeometry(s,{depth:3.9,bevelEnabled:true,bevelSize:.05,bevelThickness:.05,bevelSegments:1}).translate(0,0,-1.95);})();
  const col=new THREE.CylinderGeometry(.2,.24,2.5,16);
  const tomb=(x,z,ry)=>{
    const y=land.height(x,z),fx=Math.sin(ry),fz=Math.cos(ry),rx=Math.cos(ry),rz=-Math.sin(ry);
    batch.add(b,slab,x,y+.15,z,3.9,.3,4.3,ry);batch.add(b,stone,x-fx*.3,y+1.55,z-fz*.3,3,2.5,3.2,ry);
    batch.add(roof,slab,x,y+2.8,z,1,1,1,ry);
    for(const s of [-1.1,1.1])batch.add(col,stone,x+fx*1.6+rx*s,y+1.55,z+fz*1.6+rz*s);
    batch.add(b,dark,x+fx*1.31,y+1.2,z+fz*1.31,.95,1.7,.04,ry);
    batch.add(b,candle,x+fx*2+rx*.7,y+.45,z+fz*2+rz*.7,.1,.3,.1,ry);
    groundLight(group,x+fx*2.4,z+fz*2.4,4,0xffa050);
  };
  for(const room of zones) {
    if(room.kind==='start')continue;
    spotsNear(room,3.6,room.kind==='boss'?2:1).forEach(p=>{(group.userData.spots??=[]).push(p);tomb(p.x,p.z,Math.atan2(-Math.cos(p.a),-Math.sin(p.a)));});
  }
  batch.finish();[b,bar,tip,roof,col].forEach(g=>g.dispose());
}

// Grutas Ecoantes: estalagmites lisas, cristais azuis e violeta que acendem o chão e cogumelos que brilham.
// O verde-água fica só nas poças de veneno, para elas continuarem fáceis de ver.
export function addCaveArchitecture(group,zones,paths,land,inGap,seed,edges) {
  const rand=mulberry32(seed^0x63617665),pick=a=>a[Math.floor(rand()*a.length)];
  const glass=[[0x7a9aff,0x3050e0],[0xb08aff,0x6a30e0],[0x9ae0ff,0x2a8ad0]].map(([color,emissive])=>new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:.9,roughness:.15,metalness:.1}));
  const light={0:0x6a8aff,1:0x9a6aff,2:0x6ac0ff};
  const batch=new Masonry(group),spotsNear=findSpots(land,inGap,rand);

  // Estalagmites: finas perto da borda, grossas mais para dentro da rocha.
  const spikes=[];
  const spike=(x,z,big)=>{if(land.sd(x,z)<.9||inGap?.(x,z))return;const s=(big?.7:.4)+rand()*(big?.6:.5);spikes.push({x,y:land.height(x,z)-.15,z,s,sy:s*(2.2+rand()*1.6),ry:rand()*6.28,c:new THREE.Color(0x8a8090).multiplyScalar(.7+rand()*.45).getHex()});};
  edges.inner.forEach(p=>{if(rand()<.35)spike(p.x+(rand()-.5)*.8,p.z+(rand()-.5)*.8,false);});
  edges.outer.forEach(p=>{if(rand()<.55)spike(p.x+(rand()-.5)*2,p.z+(rand()-.5)*2,true);});
  scatterMesh(group,lathe([[1,0],[.82,.18],[.55,.45],[.32,.72],[.14,.92],[0,1]],18),surface('rock',{color:0xffffff,normalScale:new THREE.Vector2(.9,.9)}),spikes,true);

  // Cachos de cristal: prismas de 6 lados inclinados, com a luz caindo no chão.
  const cluster=(x,z,n,size)=>{
    const y=land.height(x,z),t=Math.floor(rand()*3),m=glass[t];
    for(let k=0;k<n;k++) {
      const r=(.14+rand()*.16)*size,h=(.8+rand()*1.6)*size;
      const g=mergeGeometries([new THREE.CylinderGeometry(r,r*1.1,h,6).translate(0,h/2,0),new THREE.ConeGeometry(r,r*2,6).translate(0,h+r,0)]);
      const tilt=.9/size;g.rotateZ((rand()-.5)*tilt).rotateX((rand()-.5)*tilt).rotateY(rand()*6.28); // os grandes quase retos: não invadem a arena
      batch.add(g,m,x+(rand()-.5)*.6*size,y-.15,z+(rand()-.5)*.6*size);g.dispose();
    }
    groundLight(group,x,z,3+size*1.4,light[t]);
  };
  edges.inner.forEach((p,i)=>{if(i%9===4&&!inGap?.(p.x,p.z)&&land.sd(p.x,p.z)>.8)cluster(p.x,p.z,3+Math.floor(rand()*3),1);});
  for(const room of zones) spotsNear(room,3,room.kind==='boss'?2:1).forEach(p=>{(group.userData.spots??=[]).push(p);cluster(p.x,p.z,6+Math.floor(rand()*3),2.2);});

  // Cogumelos que brilham em grupinhos, na beira e atrás das estalagmites.
  const stems=[],caps=[];
  edges.outer.forEach((p,i)=>{
    if(i%5!==2)return;
    for(let k=0;k<3+rand()*4;k++) {
      const x=p.x+(rand()-.5)*2.4,z=p.z+(rand()-.5)*2.4;if(land.sd(x,z)<.8||inGap?.(x,z))continue;
      const s=.4+rand()*.5,y=land.height(x,z)-.05;
      stems.push({x,y,z,s,ry:rand()*6.28,rz:(rand()-.5)*.3});caps.push({x,y:y+.55*s,z,s,ry:rand()*6.28,c:pick([0x5a9aff,0x9a6aff,0x4ac0ff])});
    }
  });
  scatterMesh(group,lathe([[.08,0],[.06,.3],[.07,.58],[0,.58]],10),new THREE.MeshStandardMaterial({color:0xd8d0c8,roughness:.8}),stems);
  scatterMesh(group,lathe([[.3,0],[.29,.08],[.2,.2],[0,.25]],18),new THREE.MeshStandardMaterial({color:0xffffff,emissive:0x2a40c0,emissiveIntensity:.7,roughness:.4}),caps);
  batch.finish();
}

// Rio de Magma: ilhas com lajes de basalto, rochas na beira, colunas de basalto saindo do magma
// e um respiradouro aceso perto de cada sala. As pontes continuam as do world.js.
export function addMagmaArchitecture(group,zones,paths,land,inGap,seed,edges) {
  const rand=mulberry32(seed^0x6d61676d);
  // Lajes só nas ilhas: o corredor é ponte sobre o magma.
  addPaving(group,zones,land,(x,z)=>inGap?.(x,z)||!zones.some(r=>roomD(r,x,z)<0),0x9a8a84);
  const basalt=surface('rock',{color:0x5a5250,normalScale:new THREE.Vector2(.8,.8)});
  const lava=glowM(0xff5a12,1.5),batch=new Masonry(group),spotsNear=findSpots(land,inGap,rand);

  const lvl=(x,z)=>Math.max(land.height(x,z),-.45); // superfície do magma (world.js: WATER)
  // Rochas escuras na beira das ilhas, saindo do magma.
  const rim=[];
  edges.inner.forEach(p=>{if(rand()<.1&&!inGap?.(p.x,p.z))rim.push({x:p.x+(rand()-.5)*.8,y:lvl(p.x,p.z)-.3,z:p.z+(rand()-.5)*.8,s:.5+rand()*.5,sy:.9+rand()*.6,ry:rand()*6.28,c:new THREE.Color(0x6a605c).multiplyScalar(.7+rand()*.4).getHex()});});
  const rock=surface('rock',{color:0xffffff});
  scatterMesh(group,rockBlob(),rock,rim,true);

  // Colunas de basalto de 6 lados, em grupos, saindo do magma.
  const columns=(x,z,n,hMax)=>{
    const y=lvl(x,z);
    for(let k=0;k<n;k++) {
      const a=k*2.4,d=k?.55+rand()*.5:0,h=1+rand()*hMax,cx=x+Math.cos(a)*d,cz=z+Math.sin(a)*d;
      const c=new THREE.CylinderGeometry(.42,.46,h,6);batch.add(c,basalt,cx,y+h/2-.3,cz,1,1,1,rand());c.dispose();
    }
  };
  edges.outer.forEach((p,i)=>{if(i%11===5&&!inGap?.(p.x,p.z)&&land.sd(p.x,p.z)>2)columns(p.x,p.z,4+Math.floor(rand()*4),3.5);});

  // Respiradouro: cone de rocha com a boca acesa, virado para cima.
  const vent=(x,z)=>{
    const y=lvl(x,z),g=lathe([[2.2,0],[1.9,.6],[1.2,1.8],[.8,2.6],[.55,2.7],[.5,2.4],[0,2.3]],32);
    batch.add(g,basalt,x,y-.2,z);g.dispose();
    const m=new THREE.CircleGeometry(.52,24).rotateX(-Math.PI/2);batch.add(m,lava,x,y+2.32,z);m.dispose();
    groundLight(group,x,z,5,0xff6a20);
  };
  for(const room of zones) {
    if(room.kind==='start')continue;
    spotsNear(room,3.4,room.kind==='boss'?2:1).forEach(p=>{(group.userData.spots??=[]).push(p);vent(p.x,p.z);columns(p.x+Math.cos(p.a)*3,p.z+Math.sin(p.a)*3,5,4.5);});
  }
  batch.finish();
}

// Ruínas Congeladas: lajes geladas, muros quebrados com neve em cima, colunas, montes de neve,
// lascas de gelo e um obelisco congelado perto de cada sala. O ciano forte fica só nas poças de gelo.
export function addFrostArchitecture(group,zones,paths,land,inGap,seed,edges) {
  const rand=mulberry32(seed^0x66726f73);
  addPaving(group,zones,land,inGap,0xe2eaf4);
  const stone=surface('rock',{color:0xbcc6d6,normalScale:new THREE.Vector2(.6,.6)}),slab=surface('paving',{color:0xb4bed0});
  // Neve: só o relevo da textura de rocha, sem a cor (fica lisa e branca).
  const snow=surface('rock',{map:null,color:0xdce4ee,normalScale:new THREE.Vector2(.5,.5)}),ice=new THREE.MeshStandardMaterial({color:0x6a9cd0,roughness:.22,metalness:.2,emissive:0x16304e,emissiveIntensity:.5});
  const batch=new Masonry(group),b=block(),spotsNear=findSpots(land,inGap,rand);

  // Muro quebrado de blocos com neve em cima; coluna de tempos em tempos.
  edges.inner.forEach((p,i)=>{
    if(inGap?.(p.x,p.z)||rand()<.15)return;
    const y=land.height(p.x,p.z),h=rand()<.25?1:1+Math.floor(rand()*3);
    for(let k=0;k<h;k++)batch.add(b,stone,p.x+(rand()-.5)*.1,y+.25+k*.5,p.z+(rand()-.5)*.1,1.5,.48,.8,p.ry+(rand()-.5)*.06);
    batch.add(b,snow,p.x,y+.02+h*.5,p.z,1.5,.12,.86,p.ry);
    if(i%9===4) {
      const ch=rand()<.4?1.5+rand():3.4+rand()*1.4,c=new THREE.CylinderGeometry(.48,.56,ch,20);
      batch.add(b,slab,p.x,y+.2,p.z,1.4,.4,1.4,p.ry);batch.add(c,stone,p.x,y+.4+ch/2,p.z);c.dispose();
      const cap=new THREE.SphereGeometry(.56,18,8,0,Math.PI*2,0,Math.PI/2).scale(1,.4,1);batch.add(cap,snow,p.x,y+.4+ch,p.z);cap.dispose();
    }
  });
  // Montes de neve e lascas de gelo fora da área jogável.
  const drifts=[],shards=[];
  edges.outer.forEach(p=>{
    if(inGap?.(p.x,p.z))return;
    if(rand()<.5)drifts.push({x:p.x+(rand()-.5)*2,y:land.height(p.x,p.z)-.15,z:p.z+(rand()-.5)*2,s:.9+rand()*1.3,sy:.3+rand()*.3,sz:.8+rand()*.8,ry:rand()*6.28});
    if(rand()<.22){const x=p.x+(rand()-.5)*3,z=p.z+(rand()-.5)*3;if(land.sd(x,z)>1.6)shards.push({x,y:land.height(x,z)-.2,z,s:.25+rand()*.3,sy:1.2+rand()*2,ry:rand()*6.28,rz:(rand()-.5)*.5});}
  });
  scatterMesh(group,rockBlob(),snow,drifts);
  const shard=mergeGeometries([new THREE.CylinderGeometry(1,1.1,1,6).translate(0,.5,0),new THREE.ConeGeometry(1,1.2,6).translate(0,1.6,0)]);
  scatterMesh(group,shard,ice,shards,true);

  // Obelisco congelado: degraus de pedra, agulha lisa, gelo em volta.
  const obelisk=(x,z)=>{
    const y=land.height(x,z);
    batch.add(b,slab,x,y+.2,z,3,.4,3);batch.add(b,stone,x,y+.6,z,2.2,.4,2.2);
    const g=lathe([[.7,0],[.62,3.2],[.45,4.6],[0,5.2]],4).toNonIndexed();g.computeVertexNormals(); // faces retasbatch.add(g,stone,x,y+.8,z,1,1,1,Math.PI/4);g.dispose();
    for(let k=0;k<5;k++){const a=k*1.26+rand(),g2=shard.clone().scale(.3,1+rand()*1.6,.3).rotateZ((rand()-.5)*.6).rotateY(a);batch.add(g2,ice,x+Math.cos(a)*1.5,y+.2,z+Math.sin(a)*1.5);g2.dispose();}
  };
  for(const room of zones) {
    if(room.kind==='start')continue;
    spotsNear(room,3.2,room.kind==='boss'?2:1).forEach(p=>{(group.userData.spots??=[]).push(p);obelisk(p.x,p.z);});
  }
  batch.finish();b.dispose();
}
