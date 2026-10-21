# Roteiro de arte 2D (para gerar na Makko AI)

Estilo-alvo: cartoon vetorial colorido, tipo *Plants vs Zombies*. Contorno grosso e escuro, cores chapadas com sombreado simples, formas arredondadas, personagens expressivos e um pouco engraçados (zumbis assustadores, mas simpáticos para crianças).

## Regras para todos os personagens

- Vista lateral, olhando para a **direita**.
- Fundo transparente.
- Mesmo estilo, mesma espessura de contorno e mesma paleta em tudo.
- Mesmo tamanho de quadro por personagem (ex.: 512x512), com os pés sempre na mesma linha.
- Primeiro gere uma **arte de referência** (concept) de cada personagem e use como guia para as animações.
- Exportar como sprite sheet (PNG) mais a quantidade de quadros de cada animação.

## Ordem de geração (teste primeiro)

1. Guerreiro (herói) + 1 zumbi comum. Mandar as imagens para validar o estilo antes de gerar o resto.
2. Se o estilo agradar, gerar o restante.

## Personagens e animações

| Personagem | Animações (quadros aprox.) |
|---|---|
| Guerreiro: armadura leve, espada e escudo redondo, arco nas costas | parado (6), andar (8), correr (8), pular (4), cair (2), golpe 1/2/3 (6 cada), bloquear (3), esquiva (5), levar dano (3), morrer (8), atirar arco (6) |
| Zumbi comum (walker): lento, roupa rasgada, braços esticados | parado (6), andar (8), ataque (6), dano (3), morrer (8), levantar do chão (8) |
| Zumbi corredor (runner): magro, inclinado, olhos vermelhos | parado (4), correr (8), ataque (6), dano (3), morrer (8) |
| Zumbi bruto (brute): grande, barrigudo, corrente ou clava | parado (6), andar (8), ataque (8), dano (3), morrer (8) |
| Esqueleto arqueiro | parado (6), atirar besta (8), dano (3), morrer (8) |
| Cão-zumbi | parado (4), correr (6), pulo/mordida (6), dano (3), morrer (6) |
| Necromante menor: manto, cajado | parado (6), conjurar (8), dano (3), morrer (8) |
| Carniçal Rei (chefe): zumbi grande, coroa, capa, machado | parado (6), andar (8), pancada no chão (10), golpe lateral (8), investida (6), invocar (8), atordoado (4), dano (3), morrer (12) |

## Cenários (3 fases)

Para cada fase, camadas separadas em PNG, para dar profundidade com rolagem em velocidades diferentes:

- céu (1 imagem larga)
- fundo distante (silhueta de montanhas/árvores/castelo)
- fundo médio (árvores, lápides, muralhas)
- primeiro plano leve (grama, névoa), opcional

Fases: **Cemitério da Vila** (noite roxa, lua, lápides), **Floresta Sombria** (verde escuro, árvores retorcidas), **Castelo em Ruínas** (pedra, tochas, estandartes).

## Peças para montar o chão e as plataformas

- Bloco de chão de cada fase (encaixável na horizontal): terra com grama, terra com pedra, pedra do castelo.
- Plataformas flutuantes (3 larguras) de cada fase.
- Props avulsos: lápide, cerca, árvore, tocha, fogueira (checkpoint, apagada e acesa), bandeira de fim de fase, baú, arco e flecha (item).

## Interface

- Coração (cheio/vazio), ícones de alma, flecha e botões de toque, no mesmo estilo cartoon.

## Licença

Antes de usar no jogo, conferir nos termos da Makko se o uso comercial está liberado no plano usado, para o caso de o jogo crescer.
