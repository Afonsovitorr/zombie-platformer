import { Application } from 'pixi.js';
import { Game } from './game';
import { loadSprites } from './gfx';

const msg = document.getElementById('msg')!;
msg.textContent = 'Carregando...';
msg.style.display = 'flex';

async function boot() {
  const app = new Application();
  await app.init({
    width: innerWidth,
    height: innerHeight,
    antialias: true,
    resolution: Math.min(devicePixelRatio, 2),
    autoDensity: true,
    autoStart: false,
    background: 0x1a1030,
  });
  await loadSprites((k) => (msg.textContent = `Carregando... ${Math.round(k * 100)}%`));
  msg.style.display = 'none';
  new Game(app);
}

boot().catch((e) => {
  msg.textContent = 'Erro ao carregar o jogo';
  console.error(e);
});
