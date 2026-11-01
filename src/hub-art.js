import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { surface } from './art-direction.js';

let models;
let treeParts;
export async function loadHubArt() {
  const loader = new GLTFLoader();
  const trees = ['BirchTree_1.gltf','MapleTree_1.gltf'].map(n => loader.loadAsync('assets/experiment/' + n));
  const parts = ['Wall_Plaster_Straight','Wall_Plaster_Door_Flat','Wall_Plaster_Window_Wide_Flat','Roof_RoundTiles_4x4','Door_1_Flat','Window_Wide_Flat1'].map(n => loader.loadAsync('assets/medieval/' + n + '.gltf'));
  models = await Promise.all([...trees,...parts]);
  const loaderTex = new THREE.TextureLoader();
  const normals = Object.fromEntries(await Promise.all(['WoodTrim','Plaster','RoundTiles','RockTrim'].map(async n => {
    const t = await loaderTex.loadAsync(`assets/medieval/T_${n}_Normal.png`); t.flipY=false; return [n,t];
  })));
  for (const {scene} of models.slice(2)) scene.traverse(o => {
    if (!o.isMesh) return;
    for (const m of [].concat(o.material)) {
      m.userData.shared=true;
      const name=m.name.replace('MI_','');
      if(normals[name]) {m.normalMap=normals[name];m.normalScale.set(.5,.5);}
    }
  });
  treeParts=models.slice(0,2).map(model=>{
    model.scene.updateMatrixWorld(true); const parts=[];
    model.scene.traverse(o=>{
      if(!o.isMesh)return;
      const geo=o.geometry.clone().applyMatrix4(o.matrixWorld);geo.userData.shared=true;
      const m=o.material.clone(); m.userData.shared=true;m.roughness=.96;
      if(m.name.includes('Leaves')){m.color.set(model===models[0]?0x91af75:0xb8a883);m.alphaTest=.6;m.transparent=false;}
      parts.push({geo,material:m});
    });return parts;
  });
}

export function addHubArt(group, ground = () => 0) {
  if (!models) return;
  const [birch, maple, wallPlain, wallDoor, wallWindow, roof, door, window] = models;
  addNaturalTrees(group,[{x:-16,y:0,z:7,s:1.22,ry:.7},{x:16,y:0,z:9,s:1.2,ry:1.8},{x:-16,y:0,z:-13,s:1.15,ry:2.1},{x:17,y:0,z:-13,s:1.18,ry:1.2}]);
  // As casas compartilham os materiais e são unidas em poucos grupos estáticos.
  const collection = new THREE.Group(), tops = [];
  const brick = surface('rock', { color:0xa69d8b }), glass = new THREE.MeshBasicMaterial({ color:new THREE.Color(0xe0a25a).multiplyScalar(0.8) });
  // Posições checadas contra as trilhas (Vale, Treino, Estrada do Abismo) e a borda caminhável da praça.
  for (const [i,[x,z]] of [[-17.6,-3],[17.7,-2],[-15,14],[15,15],[-7,19],[7,20],[-20.5,-9],[21,-8]].entries()) {
    const a=Math.atan2(z,x),house=new THREE.Group();
    house.position.set(x,0,z);house.rotation.y=-a-Math.PI/2;house.scale.setScalar(.95+(i%2)*.12);
    for (let side=0;side<4;side++) for (const shift of [-1,1]) {
      const front = side===0, part = front && shift===-1 ? wallDoor : (front && shift===1 ? wallWindow : wallPlain);
      const unit = new THREE.Group(); unit.rotation.y = side*Math.PI/2;
      const piece=part.scene.clone(); piece.position.set(shift,0,2); unit.add(piece);
      if (front && shift===-1) { const d=door.scene.clone(); d.position.set(shift-0.5,0,2.03); unit.add(d); }
      if (front && shift===1) { const w=window.scene.clone(); w.position.set(shift,0,2.03); unit.add(w); }
      house.add(unit);
    }
    const top = roof.scene.clone(); top.position.y = 3; house.add(top); collection.add(house);
    addYard(house, i, Math.hypot(x,z) > 19, ground);
    // Chaminé fora da cumeeira e luz quente atrás da janela da frente.
    const cx = i % 2 ? -1.3 : 1.3, stack = new THREE.Mesh(new THREE.BoxGeometry(.55, 2.6, .55), brick); stack.position.set(cx, 4.7, -1); house.add(stack);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(.7, .12, .7), brick); cap.position.set(cx, 6.04, -1); house.add(cap);
    const lit = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), glass); lit.position.set(1, 1.73, 1.62); house.add(lit);
    house.updateMatrix(); tops.push(new THREE.Vector3(cx, 6.1, -1).applyMatrix4(house.matrix));
  }
  collection.updateMatrixWorld(true);
  const batches = new Map();
  collection.traverse(o => {
    if (!o.isMesh || Array.isArray(o.material)) return;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    for (const key of Object.keys(geo.attributes)) if (!['position','normal','uv'].includes(key)) geo.deleteAttribute(key);
    const id=o.material.uuid; if (!batches.has(id)) batches.set(id,{material:o.material,geos:[]}); batches.get(id).geos.push(geo);
  });
  for (const {material,geos} of batches.values()) {
    const merged = mergeGeometries(geos); geos.forEach(g => g.dispose());
    if (merged) { const mesh = new THREE.Mesh(merged,material); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); }
  }
  return chimneySmoke(group, tops);
}

// Fumaça das chaminés: baforadas suaves que sobem, crescem e somem (um único desenho para todas).
function chimneySmoke(group, tops) {
  const N = 7, count = tops.length * N, geo = new THREE.BufferGeometry(), pos = new Float32Array(count * 3), age = new Float32Array(count);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('age', new THREE.BufferAttribute(age, 1));
  const m = new THREE.ShaderMaterial({ transparent:true, depthWrite:false, uniforms:{ uH:{ value:400 } },
    vertexShader:`attribute float age; uniform float uH; varying float vA;
      void main(){ vA=age; vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=(.45+age*1.5)*projectionMatrix[1][1]*uH/-mv.z; }`,
    fragmentShader:`varying float vA;
      void main(){ float d=length(gl_PointCoord-.5)*2.; float a=pow(max(0.,1.-d),1.6)*smoothstep(0.,.18,vA)*(1.-vA)*.3; gl_FragColor=vec4(vec3(.68,.66,.63),a); }` });
  const pts = new THREE.Points(geo, m), size = new THREE.Vector2(); pts.frustumCulled = false; group.add(pts);
  pts.onBeforeRender = r => { m.uniforms.uH.value = r.getDrawingBufferSize(size).y / 2; };
  return { update(t) {
    tops.forEach((c, h) => { for (let k = 0; k < N; k++) {
      const j = h * N + k, a = (t * .11 + k / N + h * .37) % 1;
      age[j] = a; pos.set([c.x + a * 1.1 + Math.sin(t * .6 + k + h) * .18 * a, c.y + a * 3.2, c.z + a * .4], j * 3);
    } });
    geo.attributes.position.needsUpdate = geo.attributes.age.needsUpdate = true;
  } };
}

// Canteiro sob a janela e, nas casas com espaço até a praça, cerquinha baixa deixando a porta livre.
let yardKit;
function addYard(house, i, fence, ground) {
  yardKit ??= {
    wood:new THREE.MeshStandardMaterial({color:0x7a5b3d,roughness:1}), soil:new THREE.MeshStandardMaterial({color:0x4a3a2b,roughness:1}),
    leaf:new THREE.MeshStandardMaterial({color:0x5f7d48,roughness:1}),
    blooms:[0xd9a4a6,0xeee6d2,0xb9a3cc,0xe2bf6e].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.9})),
    box:new THREE.BoxGeometry(1,1,1), mound:new THREE.SphereGeometry(1,12,8), bud:new THREE.SphereGeometry(.065,8,6),
    post:new THREE.CylinderGeometry(.06,.075,.78,10).translate(0,.39,0), rail:new THREE.CylinderGeometry(.03,.03,1,8).rotateZ(Math.PI/2)
  };
  const K=yardKit, add=(geo,m,x,y,z,sx=1,sy=1,sz=1,ry=0)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.y=ry;house.add(o);};
  // O chão sobe perto das casas: cada peça fica apoiada na altura do terreno onde está.
  house.updateMatrix(); const v=new THREE.Vector3(), lift=(x,z)=>{v.set(x,0,z).applyMatrix4(house.matrix);return Math.max(0,ground(v.x,v.z))/house.scale.x;};
  const rnd=k=>{const v=Math.sin(k*12.9898+i*78.233)*43758.5453;return v-Math.floor(v);};
  const bed=Math.max(lift(.15,2.2),lift(1.85,2.2),lift(.15,2.65),lift(1.85,2.65));
  add(K.box,K.wood,1,bed+.06,2.42,1.7,.32,.5); add(K.box,K.soil,1,bed+.225,2.42,1.56,.02,.38);
  for (let k=0;k<6;k++) add(K.mound,K.leaf,.35+k*.26,bed+.27,2.4+(rnd(k)-.5)*.14,.17,.12+rnd(k+9)*.05,.16);
  for (let k=0;k<11;k++) add(K.bud,K.blooms[(i+k)%4],.3+rnd(k+20)*1.4,bed+.36+rnd(k+40)*.05,2.28+rnd(k+60)*.28);
  if (!fence) return;
  // Pontos da cerca: lateral esquerda, lateral direita e frente do lado da janela.
  for (const line of [[[-2.3,2.15],[-2.3,3.5]],[[2.3,2.15],[2.3,3.5]],[[-.6,3.5],[2.3,3.5]]]) {
    const [[x0,z0],[x1,z1]]=line, len=Math.hypot(x1-x0,z1-z0), n=Math.max(1,Math.round(len/.95)), ry=-Math.atan2(z1-z0,x1-x0);
    const pts=Array.from({length:n+1},(_,k)=>{const px=x0+(x1-x0)*k/n,pz=z0+(z1-z0)*k/n;return [px,pz,lift(px,pz)];});
    pts.forEach(([px,pz,h],k)=>add(K.post,K.wood,px,h-.05,pz,1,.9+rnd(k+80+x0)*.15,1));
    // Trilhos entre cada par de postes, acompanhando o desnível.
    for (let k=0;k<n;k++) { const [ax,az,ah]=pts[k],[bx,bz,bh]=pts[k+1]; for (const y of [.32,.6]) add(K.rail,K.wood,(ax+bx)/2,(ah+bh)/2+y,(az+bz)/2,len/n,1,1,ry); }
  }
}

// Árvores agrupadas por região para descartar as que estão fora da câmera.
export function addNaturalTrees(group,items) {
  if(!treeParts)return;
  const cells=new Map();
  items.forEach((p,i)=>{const type=i%7===0?1:0,key=`${type}:${Math.floor(p.x/24)}:${Math.floor(p.z/24)}`;if(!cells.has(key))cells.set(key,{type,items:[]});cells.get(key).items.push(p);});
  const dummy=new THREE.Object3D();
  for(const {type,items:list} of cells.values())for(const part of treeParts[type]) {
    const mesh=new THREE.InstancedMesh(part.geo,part.material,list.length);
    list.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.y=p.ry??0;dummy.scale.setScalar(p.s??1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
    mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }
}
