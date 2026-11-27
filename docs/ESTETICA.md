# Direção de Arte: Neon Subsolo

Referências do dono do projeto em [`referencias/`](referencias/):

| Arquivo | O que tirar dela |
|---|---|
| `ref-01-corredor-mural.png` | Corredor estreito, mural de rosto com óculos, tubos de LED roxo no teto, grafite verde escorrendo, letras "HAPPY" em azul. Camadas de pichação sobrepostas. |
| `ref-02-escada-tijolo.webp` | Escada descendo, parede de tijolo coberta de tags rosa e verde, corrimão de metal escuro, uma lâmpada quente isolada, texto pintado nos degraus. |
| `ref-03-escada-frases.webp` | Escada longa e reta, frases escritas em cada degrau, coroa e palavras soltas no fundo, holofotes azuis no alto. |

## Princípios

1. **A escuridão é o fundo.** O mundo é quase preto. Tudo que se vê é luz: neon, pichação fluorescente, efeitos.
2. **Luz negra domina.** Ambiente banhado em roxo/azul ultravioleta. Cores fluorescentes "acendem" sobre ele.
3. **Bagunça com hierarquia.** Muita pichação, camadas, frases, rabiscos. Mas jogadores, armas e Tinta UV ativa sempre têm o maior contraste da tela.
4. **Futurista por cima do urbano.** Base de tijolo, concreto e metal de subsolo; por cima, tubos de LED, hologramas e interface com cara de tecnologia.

## Paleta

| Papel | Cor | Hex sugerido |
|---|---|---|
| Fundo / sombra | Preto azulado | `#07040f` |
| Luz ambiente UV | Roxo ultravioleta | `#5b1cff` |
| Luz secundária | Azul elétrico | `#2a4bff` |
| Fluorescente 1 | Rosa choque | `#ff2bd6` |
| Fluorescente 2 | Verde-limão | `#7dff3a` |
| Fluorescente 3 | Laranja | `#ff8a1f` |
| Fluorescente 4 | Ciano | `#22f2ff` |
| Luz quente pontual | Âmbar de lâmpada | `#ffcf7a` |

Times: **Rosa** contra **Verde**. No FFA, cada jogador recebe uma das cores fluorescentes.

## Técnica em Three.js (para os bots)

- **Pós-processamento:** `EffectComposer` com `UnrealBloomPass` (bloom forte nas cores fluorescentes), leve aberração cromática e granulação.
- **Materiais:** paredes com `MeshStandardMaterial` escuro + mapa emissivo de pichação. A pichação é que brilha, não a parede.
- **Pichação procedural:** gerar texturas de grafite com Canvas 2D (tags, letras, frases, respingos, escorridos) usando sementes aleatórias, para não depender de arte pronta no começo. Frases nos degraus (referência 3) com fontes de spray.
- **Decalques:** `DecalGeometry` para rastros de pichação dos jogadores e marcas de tiro.
- **Tubos de LED:** cilindros finos com material emissivo + `RectAreaLight` ou luzes pontuais baratas.
- **Tinta UV:** shader próprio: invisível quando inativa; quando ativa, acende de dentro para fora a partir do ponto de contato da aura, com cintilação e piscar antes de apagar.
- **Desempenho:** alvo de 60 FPS em notebook com vídeo integrado. Poucas luzes dinâmicas reais; o resto é emissivo + bloom. Opção de qualidade baixa/média/alta.

## Sensação de velocidade

- Campo de visão aumenta com a velocidade.
- Linhas de velocidade e leve borrão nas bordas acima de 15 m/s.
- Câmera inclina levemente nas curvas e no pulo de parede.
- Arma na mão brilha mais conforme a Carga sobe.

## Som (direção)

- Trilha: eletrônica escura, grave pesado, abafada como se viesse de outro andar da balada.
- Tiros: sintéticos, com timbre mais agudo quanto maior o dano.
- Spray de tinta, latas chacoalhando, eco de subsolo.
- Aura UV: zumbido elétrico que sobe com a velocidade.
