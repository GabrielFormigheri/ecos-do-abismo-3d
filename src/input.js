// Teclado + mouse no PC; joystick virtual e botões no toque.
export class Input {
  constructor(canvas) {
    this.keys = new Set(); this.edges = new Set();
    this.mouse = { x:0, y:0, has:false, down:false, lastMove:0 };
    this.joy = { id:null, ox:0, oy:0, dx:0, dy:0 };
    this.held = { attack:false }; this.lastTouch = 0;
    this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this.enabled = true;

    addEventListener('keydown', e => {
      if (e.target.closest?.('input, textarea')) return;
      const k = e.code;
      if (!this.keys.has(k)) {
        if (k === 'Space') this.edges.add('attack');
        if (k === 'KeyQ') this.edges.add('skill0');
        if (k === 'KeyE') this.edges.add('skill1');
        if (k === 'KeyR') this.edges.add('skill2');
        if (k === 'ShiftLeft' || k === 'ShiftRight') this.edges.add('dash');
        if (k === 'KeyF') this.edges.add('interact');
        if (k === 'Digit1' || k === 'Numpad1' || k === 'KeyH') this.edges.add('potion');
        if (k === 'Escape' || k === 'KeyP') this.edges.add('pause');
      }
      if (k === 'Space' || k.startsWith('Arrow')) e.preventDefault();
      this.keys.add(k);
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; this.held.attack = false; this.edges.add('blur'); });

    canvas.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      this.mouse.x = e.clientX / innerWidth * 2 - 1; this.mouse.y = -(e.clientY / innerHeight) * 2 + 1;
      this.mouse.has = true; this.mouse.lastMove = performance.now();
    });
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      if (e.button === 0) { this.mouse.down = true; this.edges.add('attack'); }
      if (e.button === 2) this.edges.add('skill0');
    });
    addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 0) this.mouse.down = false; });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  // Liga o joystick (área esquerda) e os botões de toque.
  bindTouch({ zone, stick, knob, attack, skills, dash, potion }) {
    const R = 52;
    addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') this.lastTouch = performance.now(); }, true);
    zone.addEventListener('pointerdown', e => {
      if (this.joy.id !== null) return;
      this.joy.id = e.pointerId; this.joy.ox = e.clientX; this.joy.oy = e.clientY; this.joy.dx = this.joy.dy = 0;
      stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px'; stick.classList.add('on');
      zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== this.joy.id) return;
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy; const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      this.joy.dx = dx / R; this.joy.dy = dy / R;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    });
    const end = e => { if (e.pointerId !== this.joy.id) return; this.joy.id = null; this.joy.dx = this.joy.dy = 0; knob.style.transform = ''; stick.classList.remove('on'); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    const hold = (el, on, off) => { el.addEventListener('pointerdown', e => { e.preventDefault(); on(); el.setPointerCapture(e.pointerId); }); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); };
    hold(attack, () => { this.held.attack = true; this.edges.add('attack'); }, () => { this.held.attack = false; });
    skills.forEach((el, i) => hold(el, () => this.edges.add('skill' + i), () => {}));
    hold(dash, () => this.edges.add('dash'), () => {});
    hold(potion, () => this.edges.add('potion'), () => {});
  }

  move() {
    let x = 0, z = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.joy.id !== null) { x = this.joy.dx; z = this.joy.dy; }
    const d = Math.hypot(x, z);
    if (d < 0.15) return { x:0, z:0 };
    return d > 1 ? { x:x / d, z:z / d } : { x, z };
  }
  attacking() { return this.keys.has('Space') || this.mouse.down || this.held.attack; }
  // Mira no mouse se ele foi usado depois do último toque; senão, mira automática.
  mouseAim() { return this.mouse.has && this.mouse.lastMove > this.lastTouch; }
  take(name) { const had = this.edges.has(name); this.edges.delete(name); return had; }
  clear() { this.edges.clear(); this.held.attack = false; this.mouse.down = false; }
}
