import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

export function addHubArt(group) {
  if (!models) return;
  const [birch, maple, wallPlain, wallDoor, wallWindow, roof, door, window] = models;
  addNaturalTrees(group,[{x:-16,y:0,z:7,s:1.22,ry:.7},{x:16,y:0,z:9,s:1.2,ry:1.8},{x:-16,y:0,z:-13,s:1.15,ry:2.1},{x:17,y:0,z:-13,s:1.18,ry:1.2}]);
  // As casas compartilham os materiais e são unidas em poucos grupos estáticos.
  const collection = new THREE.Group();
  for (const [i,[x,z]] of [[-16.9,-3],[17.1,-2],[-15,14],[15,15],[-7,19],[7,20],[-17,-20],[17,-20]].entries()) {
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
