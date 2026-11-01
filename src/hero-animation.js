const smooth = x => { x = Math.max(0, Math.min(1, x)); return x*x*(3-2*x); };
export function bowPhase(t, drawTime, recovery, cancelled) {
  if (cancelled) return { pose:0, draw:0, arrow:false };
  const d = Math.max(drawTime, .001), r = Math.max(recovery, .001);
  const pose = t < d ? smooth(t/d) : 1-smooth((t-d)/r);
  return { pose, draw:t <= d ? smooth(t/d) : 0, arrow:t < d };
}

// Os ajustes partem da pose do mixer a cada quadro; nunca acumulam rotações.
export function createBowPose(THREE, hero, weapon) {
  const rig = hero.rig, model = rig.model;
  const names = ['upperarml','lowerarml','wristl','handslotl','upperarmr','lowerarmr','wristr','handslotr','chest','head'];
  if (!names.every(n => rig.bone(n)) || !weapon.setDraw) return null;
  const leftMount = new THREE.Group(); leftMount.scale.setScalar(.72); rig.bone('handslotl').add(leftMount); leftMount.add(weapon.group);
  const vec = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);
  const quat = () => new THREE.Quaternion();
  const world = o => o.getWorldPosition(vec());
  const apply = (bone, delta) => { const parent = bone.parent.getWorldQuaternion(quat()); bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent)); bone.updateWorldMatrix(false,true); };
  function solve(side, target, pole) {
    const bones=['upperarm','lowerarm','wrist'].map(n=>rig.bone(n+side)), end=rig.bone('handslot'+side);
    model.updateWorldMatrix(true,true); const goal=model.localToWorld(target.clone()), poleWorld=model.localToWorld(pole.clone());
    const iterate=()=>{ for(let i=2;i>=0;i--){const b=bones[i],origin=world(b),a=world(end).sub(origin).normalize(),d=goal.clone().sub(origin).normalize();if(a.lengthSq() && d.lengthSq())apply(b,quat().setFromUnitVectors(a,d));} };
    for(let i=0;i<10;i++)iterate();
    const origin=world(bones[0]),axis=goal.clone().sub(origin).normalize(),elbow=world(bones[1]).sub(origin).projectOnPlane(axis).normalize(),desired=poleWorld.sub(origin).projectOnPlane(axis).normalize();
    if(axis.lengthSq() && elbow.lengthSq() && desired.lengthSq())apply(bones[0],quat().setFromAxisAngle(axis,Math.atan2(axis.dot(elbow.clone().cross(desired)),elbow.dot(desired))));
    for(let i=0;i<4;i++)iterate();
  }
  return (phase) => {
    const amount=phase?.pose ?? 0, draw=phase?.draw ?? 0;
    if (!amount) { const orientation=model.getWorldQuaternion(quat()).multiply(quat().setFromAxisAngle(vec(0,0,1),.22)).multiply(quat().setFromAxisAngle(vec(0,1,0),Math.PI/2)); leftMount.quaternion.copy(leftMount.parent.getWorldQuaternion(quat()).invert().multiply(orientation)); weapon.setDraw(0,false); return; }
    rig.bone('chest').quaternion.multiply(quat().setFromAxisAngle(vec(0,1,0),-1.15*amount));
    rig.bone('head').quaternion.multiply(quat().setFromAxisAngle(vec(0,1,0),1.15*amount));
    model.updateWorldMatrix(true,true);
    const left=model.worldToLocal(world(rig.bone('handslotl'))), right=model.worldToLocal(world(rig.bone('handslotr')));
    solve('l',left.lerp(vec(-.38,1.20,.56),amount),vec(.4,.9,.05));
    const orientation=model.getWorldQuaternion(quat()).multiply(quat().setFromAxisAngle(vec(0,0,1),.22)).multiply(quat().setFromAxisAngle(vec(0,1,0),Math.PI/2));
    leftMount.quaternion.copy(leftMount.parent.getWorldQuaternion(quat()).invert().multiply(orientation));
    model.updateWorldMatrix(true,true);
    const nock=weapon.group.localToWorld(vec(weapon.bowTips[0]+.43*draw,0,0));
    const target=model.worldToLocal(nock.clone());
    solve('r',right.lerp(target,amount),vec(-.65,1.1,-.28));
    weapon.setDraw(draw,!!phase?.arrow);
  };
}

export function attackPhase(progress, impact) {
  const p=Math.max(0,Math.min(1,progress)), hit=Math.max(.01,Math.min(.99,impact));
  return p <= hit ? .59*p/hit : .59+.41*(p-hit)/(1-hit);
}

export function createAxePose(THREE, hero, weapon) {
  const rig=hero.rig, model=rig.model, end=rig.bone('handslotl');
  const bones=['upperarml','lowerarml','wristl'].map(n=>rig.bone(n));
  if (!end || bones.some(b=>!b)) return null;
  const v=()=>new THREE.Vector3(), q=()=>new THREE.Quaternion();
  return weight=>{
    if (!weight) return;
    model.updateWorldMatrix(true,true);
    const goal=weapon.group.localToWorld(new THREE.Vector3(0,-.34,0));
    goal.lerp(end.getWorldPosition(v()),1-weight);
    for(let pass=0;pass<12;pass++) for(let i=2;i>=0;i--){
      const bone=bones[i], origin=bone.getWorldPosition(v()), from=end.getWorldPosition(v()).sub(origin).normalize(), to=goal.clone().sub(origin).normalize();
      if (!from.lengthSq() || !to.lengthSq()) continue;
      const parent=bone.parent.getWorldQuaternion(q()), delta=q().setFromUnitVectors(from,to);
      bone.quaternion.premultiply(parent.clone().invert().multiply(delta).multiply(parent)); bone.updateWorldMatrix(false,true);
    }
  };
}
