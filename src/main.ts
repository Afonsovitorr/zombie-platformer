import { Game } from './game';
import { loadModels } from './models';

const msg = document.getElementById('msg')!;
msg.textContent = 'Carregando...';
msg.style.display = 'flex';

loadModels()
  .then(() => {
    msg.style.display = 'none';
    new Game();
  })
  .catch((e) => {
    msg.textContent = 'Erro ao carregar os modelos';
    console.error(e);
  });
