import { Application, Container, Graphics, Text } from 'pixi.js';
import { Rig, type Pose } from './rig';
import { STYLES } from './styles';
import * as A from './anims';

// Dev-only sheet that shows every character in every animation. ?t=<seconds>&k=<0..1> freezes time.
const q = new URLSearchParams(location.search);
const frozen = q.has('t');
const T0 = Number(q.get('t') ?? 0);
const K = Number(q.get('k') ?? 0.5);
const rows = (q.get('rows') ?? 'hero,walker,runner,brute,archer,necro,king').split(',');
const cols = (q.get('cols') ?? 'idle,walk,run,attack,hurt,dead').split(',');

const hero = (a: string, t: number, k: number): Pose => {
  switch (a) {
    case 'walk': return A.heroWalk(t, 1);
    case 'run': return A.heroRun(t);
    case 'jump': return A.heroJump();
    case 'fall': return A.heroFall();
    case 'attack': return A.heroAttack(0, k);
    case 'attack2': return A.heroAttack(1, k);
    case 'attack3': return A.heroAttack(2, k);
    case 'plunge': return A.heroPlunge();
    case 'block': return A.heroBlock(t);
    case 'dodge': return A.heroDodge(k);
    case 'hurt': return A.heroHurt(k);
    case 'dead': return A.heroDead(k);
    case 'shoot': return A.heroShoot(k);
    default: return A.heroIdle(t);
  }
};
const undead = (id: string) => (a: string, t: number, k: number): Pose => {
  const caster = id === 'necro';
  const archer = id === 'archer';
  switch (a) {
    case 'walk': return caster || archer ? A.heroWalk(t, 0.8) : A.zombieWalk(t, 1);
    case 'run': return id === 'runner' ? A.zombieRun(t) : A.zombieWalk(t, 1.4);
    case 'attack': return caster ? A.castPose(k) : archer ? A.crossbowShoot(k) : A.zombieAttack(k, id === 'king' ? 'swipe' : 'smash');
    case 'hurt': return A.zombieHurt(k);
    case 'dead': return A.zombieDead(k);
    case 'rise': return A.zombieRise(k);
    case 'stun': return A.stunned(t);
    default: return caster || archer ? { ...A.heroIdle(t), sh1: 0.6, el1: 0.8 } : A.zombieIdle(t);
  }
};

const app = new Application();
await app.init({ resizeTo: window, background: 0x2a2150, antialias: true, resolution: window.devicePixelRatio, autoDensity: true });
document.body.appendChild(app.canvas);

const cells: { rig: Rig; fn: (t: number, k: number) => Pose; once: boolean }[] = [];
const cw = window.innerWidth / cols.length;
const ch = window.innerHeight / rows.length;
const scale = Math.min(cw / 190, ch / 250);

rows.forEach((id, r) => {
  cols.forEach((a, c) => {
    const rig = new Rig(STYLES[id === 'hero' && a === 'shoot' ? 'heroBow' : id]);
    const cell = new Container();
    cell.position.set(c * cw + cw / 2, r * ch + ch * 0.86);
    cell.scale.set(scale);
    cell.addChild(rig.root);
    app.stage.addChild(cell);
    const label = new Text({ text: `${id} / ${a}`, style: { fill: 0xffffff, fontSize: 12, fontFamily: 'sans-serif' } });
    label.position.set(c * cw + 6, r * ch + 4);
    app.stage.addChild(label);
    if (c === 0) app.stage.addChild(new Graphics().moveTo(0, r * ch).lineTo(window.innerWidth, r * ch).stroke({ width: 1, color: 0xffffff, alpha: 0.1 }));
    const fn = id === 'hero' || id === 'heroBow' ? (t: number, k: number) => hero(a, t, k) : (t: number, k: number) => undead(id)(a, t, k);
    cells.push({ rig, fn, once: ['attack', 'attack2', 'attack3', 'hurt', 'dead', 'dodge', 'shoot', 'rise'].includes(a) });
  });
});

let clock = T0;
const draw = (snap: boolean) => {
  for (const c of cells) {
    const k = frozen ? K : (clock % 1.6) / 1.6;
    c.rig.target = c.fn(clock, c.once ? k : 0);
    c.rig.blend(snap ? 1 : 0.5);
  }
};
draw(true);
if (!frozen) app.ticker.add((tk) => { clock += tk.deltaMS / 1000; draw(false); });
(window as unknown as { __ready: boolean }).__ready = true;
