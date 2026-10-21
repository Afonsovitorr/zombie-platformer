export type Action = 'left' | 'right' | 'jump' | 'attack' | 'ranged' | 'dodge' | 'block' | 'restart' | 'pause' | 'mute';

const ACTIONS: Action[] = ['left', 'right', 'jump', 'attack', 'ranged', 'dodge', 'block', 'restart', 'pause', 'mute'];

const KEYS: Record<string, Action> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  KeyJ: 'attack', KeyZ: 'attack',
  KeyI: 'ranged', KeyX: 'ranged',
  KeyL: 'dodge', KeyC: 'dodge', ShiftLeft: 'dodge',
  KeyK: 'block', KeyV: 'block', ArrowDown: 'block', KeyS: 'block',
  KeyR: 'restart',
  Escape: 'pause', KeyP: 'pause',
  KeyM: 'mute',
};

const record = (v: boolean) => Object.fromEntries(ACTIONS.map((a) => [a, v])) as Record<Action, boolean>;

export class Input {
  held = record(false);
  pressed = record(false);
  moveX = 0;

  private keys = new Set<Action>();
  private touch = new Set<Action>();
  private latched = record(false);
  private prev = record(false);

  constructor(touchRoot: HTMLElement) {
    addEventListener('keydown', (e) => {
      const a = KEYS[e.code];
      if (!a) return;
      e.preventDefault();
      if (!this.keys.has(a)) this.latched[a] = true;
      this.keys.add(a);
    });
    addEventListener('keyup', (e) => {
      const a = KEYS[e.code];
      if (a) this.keys.delete(a);
    });
    addEventListener('blur', () => this.keys.clear());
    this.buildTouch(touchRoot);
  }

  private buildTouch(root: HTMLElement) {
    const defs: [Action, string, string, string][] = [
      ['left', '◀', 'tb pad', 't-left'],
      ['right', '▶', 'tb pad', 't-right'],
      ['jump', 'PULAR', 'tb act', 't-jump'],
      ['attack', 'ATACAR', 'tb act', 't-attack'],
      ['ranged', 'ARCO', 'tb act', 't-ranged'],
      ['dodge', 'ESQUIVA', 'tb act', 't-dodge'],
      ['block', 'ESCUDO', 'tb act', 't-block'],
      ['pause', 'II', 'tb pause', 't-pause'],
    ];
    for (const [action, label, cls, id] of defs) {
      const el = document.createElement('div');
      el.id = id;
      el.className = cls;
      el.textContent = label;
      const down = (e: PointerEvent) => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        if (!this.touch.has(action)) this.latched[action] = true;
        this.touch.add(action);
        el.classList.add('on');
      };
      const up = (e: PointerEvent) => {
        e.preventDefault();
        this.touch.delete(action);
        el.classList.remove('on');
      };
      el.addEventListener('pointerdown', down);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      root.appendChild(el);
    }
    const coarse = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (coarse) document.body.classList.add('touch');
    addEventListener('touchstart', () => document.body.classList.add('touch'), { once: true, passive: true });
  }

  // Call once per simulation step.
  update() {
    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p && p.connected) ?? null;
    const padHeld = record(false);
    let padX = 0;
    if (pad) {
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      padX = Math.abs(pad.axes[0] ?? 0) > 0.25 ? pad.axes[0] : 0;
      if (b(14)) padX = -1;
      if (b(15)) padX = 1;
      padHeld.jump = b(0) || b(12);
      padHeld.dodge = b(1);
      padHeld.attack = b(2);
      padHeld.ranged = b(3);
      padHeld.block = b(5) || b(7) || b(4) || b(6);
      padHeld.restart = b(8);
      padHeld.pause = b(9);
    }

    for (const a of ACTIONS) {
      const cur = this.keys.has(a) || this.touch.has(a) || padHeld[a];
      this.held[a] = cur;
      this.pressed[a] = this.latched[a] || (cur && !this.prev[a]);
      this.prev[a] = cur;
      this.latched[a] = false;
    }
    const kb = (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
    this.moveX = kb !== 0 ? kb : padX;
  }
}
