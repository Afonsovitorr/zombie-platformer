# Zombie Platformer — Game Design Document (rascunho v0.1)

Título provisório: **a definir** (ideias: "Cavaleiro das Cinzas", "Marcha dos Mortos", "Último Reino").
Rascunho para revisão. Tudo marcado com **[?]** é decisão em aberto.

## 1. Visão
Plataforma 2D de fantasia medieval em cartoon vetorial colorido (estilo Plants vs Zombies). Um guerreiro atravessa um reino tomado por mortos-vivos.
Jogabilidade num plano 2D com cenário 3D (referência: Trine, Hollow Knight, Ori).
Sensação: desafiador e exploratório. Combate com peso, risco e recompensa; fases com atalhos e segredos.

- Público: jogador principal e o filho (hobby/família). Violência estilizada, sem sangue realista.
- Meta da demo: 3 fases + 1 chefe + sistema de progressão funcionando.
- Plataforma: navegador (PC e tablet), teclado, gamepad e toque.

## 2. Mundo e história (proposta)
Um feitiço sombrio transformou o reino em mortos-vivos. O guerreiro é o último de uma ordem de cavaleiros
e cruza o reino até a fonte da maldição. **[?]** Quem é o vilão (necromante, rei amaldiçoado, dragão-morto)?
**[?]** O herói tem nome e personalidade? (sugestão: o filho escolhe)

Regiões da campanha completa (a demo usa as 3 primeiras):
1. Cemitério da Vila (tutorial, ensina o básico)
2. Floresta Sombria (verticalidade, plataformas, arqueiros)
3. Castelo em Ruínas (chefe da demo)
4. Catacumbas (exploração, armadilhas)
5. Torre do Necromante (chefe final)

### Decisões do dono do projeto (registradas)
- **Vilões:** o Carniçal Rei, o Dragão-morto e o Necromante entram todos, cada um como chefe de uma região, e a lista de chefes vai crescer com o tempo. O Necromante é o chefe final.
- **Economia:** loja com NPC, loot e baús.
- **Nome do herói e título:** pendentes (o filho vai escolher).
- **Inimigos e combate:** lista e combate aprovados; novos tipos e mecânicas serão adicionados ao longo do tempo.
- **Progressão:** aprovada; deve ganhar mais profundidade com o tempo.

## 3. Herói e combate
Controles da base atual: mover, pular, atacar, arco, bloquear, esquivar.

Evolução planejada:
- **Combo de 3 golpes** (rápido, rápido, finalizador pesado com knockback).
- **Bloqueio com parry**: bloquear no instante certo (janela ~0,15 s) anula o dano, não gasta stamina e atordoa o inimigo.
- **Esquiva** com invencibilidade curta; no ar vira dash.
- **Ataque no ar** e **ataque para baixo** (pogo sobre inimigos e espinhos).
- **Arco** com munição limitada e flechas coletáveis; tipos de flecha viram upgrade.
- **Stamina** governa esquiva, bloqueio e ataque pesado.
- Pulo duplo e pulo na parede liberados por progressão, não de início.

## 4. Inimigos
| Inimigo | Papel | Comportamento |
|---|---|---|
| Zumbi comum | Base | Persegue, golpe lento telegrafado |
| Zumbi corredor | Pressão | Rápido, pouca vida, investida |
| Zumbi brutamontes | Tanque | Golpe de área, só leva dano após parry ou por trás |
| Esqueleto arqueiro | À distância | Fica em plataformas altas, atira |
| Cão-zumbi | Flanco | Salta no jogador |
| Necromante menor | Suporte | Revive zumbis, prioridade de alvo |

Regra de design: todo ataque inimigo tem telegrafia visível (cor + pose) para o jogador ler e reagir.

## 5. Chefes
- **Fase 3: Carniçal Rei (chefe da demo)**: 3 fases de luta (golpes de corpo, invoca zumbis, enfurece com 30% de vida). Recompensa: habilidade nova (pulo duplo).
- Chefe final (campanha completa): Necromante, com arena em múltiplos andares.

## 6. Progressão
Dois recursos:
- **Almas**: dropadas por inimigos; gastas na árvore de habilidades em pontos de descanso (fogueiras).
- **Fragmentos de relíquia**: achados em segredos; melhoram vida/stamina máximas.

Árvore de habilidades (3 ramos):
- **Lâmina**: dano, combo estendido, ataque giratório, sangramento (dano contínuo).
- **Bastião**: vida, stamina, janela de parry maior, contra-ataque após parry.
- **Caçador**: arco (munição, flecha perfurante, flecha explosiva), esquiva mais longa.

Habilidades de mobilidade (desbloqueadas por chefes): pulo duplo, dash aéreo, pulo na parede.
Equipamento: espada, escudo e armadura com 3 níveis cada, achados ou comprados. **[?]** Loja com NPC ou só loot?

## 7. Estrutura das fases
Lineares com ramificações curtas: caminho principal, 1–2 desvios com segredo (relíquia ou atalho).
Pontos de descanso a cada ~2 minutos: curam, salvam progresso e reaparecem os inimigos.
Duração alvo: 8–12 min por fase.

## 8. Direção de arte e áudio
- Cartoon vetorial colorido (contorno grosso, cores chapadas, rostos expressivos), com acentos quentes (tochas, fogueiras).
- Sprites CC0 (akylrum) recoloridos em mortos-vivos; cenário desenhado em código.
- Câmera lateral 2D com camadas de parallax; foco no herói.
- Áudio: música ambiente por região (loops CC0/OpenGameArt), efeitos de golpe, bloqueio, passos e zumbis.
- Feedback de combate (hit-stop, tremor de câmera, partículas) é parte do design, não enfeite.

## 9. Escopo
**Demo (meta atual):** herói completo, 3 fases, 4 tipos de inimigo, 1 chefe, árvore de habilidades parcial, menu, save, tela de morte.
**Fora da demo:** fases 4–5, chefe final, loja, mais armas, co-op.

## 10. Marcos
1. **Arquitetura:** dados de fase, inimigo e habilidade em arquivos; máquina de estados; save; menu.
2. **Jogabilidade:** combo, parry, tipos de inimigo, ataque aéreo, pulo duplo, sistema de almas e habilidades.
3. **Arte e áudio:** modelos e animações reais, cenário, música, efeitos.
4. **Conteúdo:** 3 fases, chefe, balanceamento, polimento.
5. **Publicação:** GitHub (conta pessoal) + GitHub Pages.

## 11. Estado atual (demo)
- Fases implementadas: Cemitério da Vila, Floresta Sombria e Castelo em Ruínas (com arena do chefe).
- Inimigos: zumbi, corredor, brutamontes, esqueleto arqueiro, cão-zumbi (filhote de dragão provisório), necromante menor.
- Chefe: Carniçal Rei, 3 fases de luta (golpes de área e onda no chão; invoca zumbis abaixo de 66%; investida abaixo de 33%). Recompensa: pulo duplo.
- Dificuldade alvo: desafiador mas justo (ainda precisa de teste humano e balanceamento).
