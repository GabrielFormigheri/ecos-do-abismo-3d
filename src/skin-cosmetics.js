// Cosmetic layer only: no saves, equipment ownership, lights, particles or gameplay rules.
// The factory skips the legacy celestial/ceifador FX and calls this after equipment.
import * as THREE from '../vendor/three/build/three.module.js';

const SKIN_BODY = { celestial:'Knight', ceifador:'Skeleton_Rogue', guardiao:'Knight', errante:'Rogue_Hooded' };
export const visualBodyForSkin = id => Object.hasOwn(SKIN_BODY,id) ? SKIN_BODY[id] : null;
export const PROCEDURAL_SKIN_LOOK = {
  guardiao:{head:0x6d7c79,torso:0x6d7c79,arms:0x363f43,legs:0x363f43,metal:{roughness:.9,metalness:.2}},
  errante:{head:0xf1c27d,torso:0x63445e,arms:0x39343d,legs:0x332d34,metal:{roughness:.95}},
};
const geometries=new Map();
function shared(key,create){if(!geometries.has(key)){const g=create();g.userData.shared=true;geometries.set(key,g);}return geometries.get(key);}
const geo={
  box:shared('box',()=>new THREE.BoxGeometry(1,1,1)),
  shard:shared('shard',()=>new THREE.OctahedronGeometry(1)),
  ring:shared('ring',()=>new THREE.TorusGeometry(1,.055,5,32)),
  plate:shared('plate',()=>new THREE.SphereGeometry(1,8,4,0,Math.PI*2,0,Math.PI/2)),
};
const materials=new Map();
function material(c,metal=.1,rough=.8,em=0){const k=[c,metal,rough,em].join();if(!materials.has(k))materials.set(k,new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough,flatShading:true,side:THREE.DoubleSide,emissive:em?c:0,emissiveIntensity:em}));const m=materials.get(k);m.userData.shared=true;return m;}
const ivory=material(0xdad7c7,.48,.47), brass=material(0xb99c61,.72,.44), navy=material(0x263d54,0,.95), charcoal=material(0x24232b,0,.98), bone=material(0xd8c9ad,.05,.8), silver=material(0xa6aca9,.7,.52), stone=material(0x6d7c79,.12,.95), iron=material(0x363f43,.7,.55), teal=material(0x66c8c0,.25,.4,.45), plum=material(0x63445e,0,.98), amber=material(0xb18144,.35,.65,.35), rust=material(0x85544d,.1,.87);
function mesh(g,m,x=0,y=0,z=0,sx=1,sy=1,sz=1){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.userData.skinCosmetic=true;return o;}
function attach(h, name, obj, dx=0, dy=0, dz=0) {
  const rig=h.rig, bone=rig.bone(name);
  if (!bone) return obj;
  rig.model.updateMatrixWorld(true);
  const relative=new THREE.Quaternion().copy(obj.quaternion);
  const base=bone.getWorldPosition(new THREE.Vector3());
  rig.model.worldToLocal(base).add(new THREE.Vector3(dx,dy,dz));
  const world=rig.model.localToWorld(base);
  const orientation=bone.getWorldQuaternion(new THREE.Quaternion()).invert()
    .multiply(rig.model.getWorldQuaternion(new THREE.Quaternion()));
  const scale=bone.getWorldScale(new THREE.Vector3()).x / rig.model.getWorldScale(new THREE.Vector3()).x;
  bone.add(obj); obj.position.copy(bone.worldToLocal(world));
  obj.quaternion.copy(orientation).multiply(relative); obj.scale.divideScalar(scale);
  return obj;
}
function repaint(h,fn){h.rig.model.traverse(o=>{if(o.isMesh&&o.visible&&/^(Knight_|Skeleton_|Rogue_)/.test(o.name))fn(o);});}
function flat(o,m){o.material=m;}
function keepTexture(o,c,rough=.85,metal=.05){o.material.color.set(c);o.material.emissive?.set(0);o.material.emissiveIntensity=0;o.material.roughness=rough;o.material.metalness=metal;}
const hoodTextures=new WeakMap();
function plumHood(texture){
 if(!texture?.image || typeof document==='undefined')return texture;
 if(hoodTextures.has(texture))return hoodTextures.get(texture);
 const image=texture.image,c=document.createElement('canvas');c.width=image.width;c.height=image.height;
 const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,c.width,c.height);
 for(let i=0;i<pixels.data.length;i+=4){const r=pixels.data[i],g=pixels.data[i+1],b=pixels.data[i+2];if(g>r*1.2&&g>b*1.05){const shade=Math.min(1.5,Math.max(.35,g/110));pixels.data[i]=99*shade;pixels.data[i+1]=68*shade;pixels.data[i+2]=94*shade;}}
 ctx.putImageData(pixels,0,0);const t=new THREE.CanvasTexture(c);t.flipY=texture.flipY;t.colorSpace=texture.colorSpace;t.minFilter=texture.minFilter;t.magFilter=texture.magFilter;t.userData.shared=true;hoodTextures.set(texture,t);return t;
}
function hideCape(h){if(h.skinEquipment?.cape)return;h.rig.model.traverse(o=>{if(o.isMesh&&/_Cape$/.test(o.name))o.visible=false;});}
const clothCache=new Map();
function cloth(key,points){if(!clothCache.has(key)){const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const g=new THREE.ShapeGeometry(s);g.userData.shared=true;clothCache.set(key,g);}return clothCache.get(key);}
function cloak(h,key,m,points,x=0,y=.2,z=-.38){if(h.cape||h.skinEquipment?.cape)return h.cape;const c=mesh(cloth(key,points),m);c.rotation.x=.1;attach(h,'chest',c,x,y,z);return c;}
function mantle(h,m,sides=[-1,1]){if(h.skinEquipment?.armor)return;for(const s of sides){const p=mesh(geo.plate,m,0,0,0,.28,.17,.28);attach(h,s<0?'upperarml':'upperarmr',p,s*.025,.16,0);}}
function trim(h,m,x,y,z,sx,sy,sz,b='chest'){return attach(h,b,mesh(geo.box,m,0,0,0,sx,sy,sz),x,y,z);}
const applied=new WeakSet();
export function applySkinCosmetics(h,id){
 if(!h?.rig?.model||!h.rig.bone('head')||!h.rig.bone('chest')||!visualBodyForSkin(id)||applied.has(h))return h;
 const equipped=!!h.skinEquipment?.armor;
 const chestOccupied=!!h.skinEquipment?.chest;
 if(id==='celestial'){
  repaint(h,o=>{if(/Cape/.test(o.name))flat(o,navy);else if(/Helmet|Body|Arm|Leg/.test(o.name))flat(o,ivory);else keepTexture(o,0xffffff);});hideCape(h);
  cloak(h,'celestial',navy,[[-.43,0],[.43,0],[.4,-1.35],[.15,-1.48],[0,-1.1],[-.15,-1.48],[-.4,-1.35]]);
  const halo=mesh(geo.ring,brass,0,0,0,.38,.38,.38);halo.rotation.x=Math.PI/2;attach(h,'head',halo,0,1.38,0);
  mantle(h,brass);trim(h,brass,0,-.3,.34,.58,.065,.05);trim(h,navy,0,-.75,.33,.28,.75,.045);
  const crest=mesh(geo.shard,brass,0,0,0,.06,.22,.27);attach(h,'head',crest,0,.92,-.05);
  for(const s of [-1,1])for(let k=0;k<3;k++){
   const feather=mesh(geo.shard,k===0?brass:ivory,0,0,0,.12,.45-k*.04,.045);
   feather.rotation.z=-s*(.4+k*.35);attach(h,'chest',feather,s*(.55+k*.14),.1+k*.02,-.43-k*.03);
  }
  if(!chestOccupied){const gem=mesh(geo.shard,material(0x9ecad0,.3,.4,.2),0,0,0,.075,.12,.04);attach(h,'chest',gem,0,.07,.38);}
 }else if(id==='ceifador'){
  repaint(h,o=>{if(/Eyes/.test(o.name)){flat(o,material(0xb05743,0,.6,.7));}else if(/Head|Jaw|Arm|Leg/.test(o.name))keepTexture(o,0xe6dcc5);else flat(o,charcoal);});hideCape(h);
  cloak(h,'ceifador',charcoal,[[-.5,0],[.49,0],[.62,-1.38],[.32,-1.17],[.18,-1.58],[-.02,-1.28],[-.22,-1.55],[-.34,-1.18],[-.58,-1.42]]);
  mantle(h,charcoal,[-1]);
  const cowl=mesh(geo.ring,charcoal,0,0,0,.43,.43,.43);cowl.rotation.x=Math.PI/2;attach(h,'chest',cowl,0,.21,-.02);
  trim(h,rust,-.27,.1,.29,.09,.28,.09);
  const brooch=mesh(geo.ring,bone,0,0,0,.1,.1,.1);attach(h,'chest',brooch,-.29,.13,.36);
  for(let i=0;i<3;i++){const tally=mesh(geo.box,bone,0,0,0,.02,.12,.02);tally.rotation.z=-.25;attach(h,'chest',tally,-.35+i*.06,-.04,.35);}
  trim(h,rust,0,-.4,.25,.72,.09,.09);
 }else if(id==='guardiao'){
  if(!equipped)repaint(h,o=>{if(/Helmet|Body/.test(o.name))flat(o,stone);else if(/Arm|Leg/.test(o.name))flat(o,iron);else if(/Cape/.test(o.name))flat(o,navy);else keepTexture(o,0xc4cebf);});hideCape(h);
  cloak(h,'eco',navy,[[-.38,0],[.38,0],[.35,-.82],[.06,-1.02],[-.32,-.82]]);
  mantle(h,stone,[-1]);mantle(h,iron,[1]);
  if(!equipped){const slab=mesh(geo.shard,stone,0,0,0,.36,.31,.28);slab.rotation.z=.25;attach(h,'upperarml',slab,-.1,.18,0);
  const broken=mesh(geo.shard,stone,0,0,0,.16,.2,.14);broken.rotation.z=-.3;attach(h,'upperarml',broken,-.3,.29,-.04);
  const seam=mesh(geo.box,teal,0,0,0,.025,.18,.025);seam.rotation.z=.2;attach(h,'upperarml',seam,-.25,.2,.23);}
  trim(h,brass,-.3,-.03,.35,.08,.42,.045);trim(h,brass,.3,-.03,.35,.08,.42,.045);
  if(!chestOccupied){const frame=mesh(geo.shard,iron,0,0,0,.24,.34,.09);attach(h,'chest',frame,0,-.03,.37);
  const a=mesh(geo.shard,teal,0,0,0,.105,.19,.065);a.rotation.z=-.25;attach(h,'chest',a,-.055,.005,.47);
  const b=mesh(geo.shard,teal,0,0,0,.07,.125,.055);b.rotation.z=.3;attach(h,'chest',b,.09,-.085,.47);}
  const notch=mesh(geo.shard,teal,0,0,0,.035,.07,.03);attach(h,'head',notch,-.21,.74,.45);
  for(const s of [-1,1])trim(h,stone,s*.26,-.72,.22,.3,.47,.1);
  const seal=mesh(shared('preview-echo-seal',()=>new THREE.TorusGeometry(.22,.035,4,16,Math.PI*1.65)),brass);seal.rotation.z=.6;attach(h,'chest',seal,0,-.34,-.415);
  attach(h,'chest',mesh(geo.shard,teal,0,0,0,.04,.08,.025),-.08,-.32,-.45);
 }else if(id==='errante'){
  if(!equipped)repaint(h,o=>{if(/Head/.test(o.name)){o.material.map=plumHood(o.material.map);keepTexture(o,0xffffff);}else if(/Body|Cape/.test(o.name))flat(o,plum);else if(/Arm/.test(o.name))flat(o,material(0x39343d,0,.94));else flat(o,material(0x332d34,0,.95));});hideCape(h);
  cloak(h,'errante',plum,[[-.48,0],[.42,0],[.44,-.88],[.1,-1.3],[-.22,-1.42],[-.5,-1.08]],-.02,.21,-.37);
  mantle(h,silver,[-1]);
  const strap=trim(h,material(0x443633,0,.9),0,-.18,.33,.11,.83,.06);strap.rotation.z=-.48;
  const clasp=mesh(geo.ring,silver,0,0,0,.1,.1,.1);attach(h,'chest',clasp,-.29,.12,.37);
  const buckle=mesh(geo.shard,silver,0,0,0,.075,.09,.035);attach(h,'chest',buckle,.2,-.5,.33);
  // Lantern stays behind the left hip, clear of the right-hand weapon mount.
  const lantern=new THREE.Group();lantern.add(mesh(geo.box,iron,0,0,0,.18,.23,.16));
  lantern.add(mesh(geo.box,amber,0,.015,.09,.11,.13,.015));
  const loop=mesh(geo.ring,silver,0,.17,0,.065,.065,.065);lantern.add(loop);attach(h,'chest',lantern,-.54,-.7,-.44);
  const tail=trim(h,plum,-.27,-.7,.27,.16,.6,.04);tail.rotation.z=-.16;
 }
 // Cosmetic parts attach to the same bones; all equipment objects added by createHeroRig remain.
 applied.add(h);
 return h;
}
