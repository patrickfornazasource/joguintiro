# Direção de Arte: Neon Abandonado

> **Regra de ouro: legibilidade antes de clima.** As fotos de referência dão a paleta e a energia (pichação fluorescente, luz negra, LED), **não o nível de escuridão**. O jogo é bem mais claro que as fotos.

Referências do dono do projeto em [`referencias/`](referencias/):

| Arquivo | O que tirar dela |
|---|---|
| `ref-01-corredor-mural.png` | Corredor estreito, mural de rosto com óculos, tubos de LED roxo no teto, grafite verde escorrendo, letras "HAPPY" em azul. Camadas de pichação sobrepostas. |
| `ref-02-escada-tijolo.webp` | Escada descendo, parede de tijolo coberta de tags rosa e verde, corrimão de metal escuro, uma lâmpada quente isolada, texto pintado nos degraus. |
| `ref-03-escada-frases.webp` | Escada longa e reta, frases escritas em cada degrau, coroa e palavras soltas no fundo, holofotes azuis no alto. |

## Princípios

1. **Ambiente claro o suficiente para jogar.** Nada de breu. Há sempre luz ambiente de base (céu por buracos no teto, janelas quebradas, refletores de obra, lâmpadas fluorescentes), e as superfícies em tom médio, não preto. O neon e a luz UV são **acento de cor**, não a única fonte de luz.
2. **O jogador é a coisa mais visível da tela.** Silhueta clara, contorno de alto contraste em qualquer fundo, cor do jogador/time saturada. Nenhuma pichação, efeito ou brilho pode ter a mesma cor e intensidade de um jogador.
3. **Bagunça com hierarquia.** Muita pichação, camadas, frases, rabiscos, entulho. Mas a ordem de destaque é fixa:
   1. Jogadores inimigos.
   2. Tiros, projéteis e perigos.
   3. Tinta UV ativa e elementos de movimento (paredes de corrida, plataformas de salto, corrimãos).
   4. Pichação e decoração (a mais apagada das quatro, por mais colorida que seja).
4. **Superfícies de movimento se leem de longe.** Parede onde dá para correr, plataforma de salto e corrimão têm marcação visual consistente em todos os mapas (ex.: faixa de fita fluorescente na borda).
5. **Urbano abandonado + toque futurista.** Base de tijolo, concreto, azulejo, metal enferrujado; por cima, tubos de LED, letreiros, hologramas e interface tecnológica.

## Testes de visibilidade (obrigatórios nas tarefas de arte)

- **Teste da captura em cinza:** a captura de tela convertida para preto e branco ainda mostra o jogador claramente destacado do cenário.
- **Teste de distância:** um jogador parado a 40 m é identificável sem mira.
- **Brilho médio da cena:** nenhum ponto de nascimento ou área de combate pode ficar abaixo de um brilho médio mínimo (definir número na tarefa F5-10, medido por script).
- **Opção de acessibilidade:** controle de brilho e de intensidade do bloom nas configurações.

## Ambientações (locais dos mapas)

Todos abandonados e tomados por pichação, mas cada um com luz própria:

| Local | Luz principal | Clima |
|---|---|---|
| **Estação de metrô desativada** | Lâmpadas fluorescentes falhando + luz do dia pelas grades | Azulejo, trilhos, vagões pichados |
| **Fábrica / galpão** | Luz do dia por telhado furado + refletores | Amplo, vigas de metal, passarelas, vertical |
| **Casa noturna abandonada (subsolo)** | Luz negra + LED + refletores de serviço acesos | O mais próximo das fotos de referência, mas com luz de serviço garantindo visibilidade |
| **Shopping / estacionamento abandonado** | Claraboias quebradas, luz natural | Rampas, escadas rolantes paradas, muito espaço para correr |
| **Piscina pública vazia** | Céu aberto, pôr do sol | Curvas de concreto para deslizar, pichação no fundo da piscina |

## Paleta

| Papel | Cor | Hex sugerido |
|---|---|---|
| Sombra mais escura permitida | Cinza azulado | `#2a2638` |
| Superfícies base | Concreto / tijolo em tom médio | `#6b6478` |
| Luz ambiente UV | Roxo ultravioleta | `#5b1cff` |
| Luz secundária | Azul elétrico | `#2a4bff` |
| Fluorescente 1 | Rosa choque | `#ff2bd6` |
| Fluorescente 2 | Verde-limão | `#7dff3a` |
| Fluorescente 3 | Laranja | `#ff8a1f` |
| Fluorescente 4 | Ciano | `#22f2ff` |
| Luz quente pontual | Âmbar de lâmpada | `#ffcf7a` |

Times: **Rosa** contra **Verde**. No FFA, cada jogador recebe uma das cores fluorescentes.

## Técnica em Three.js (para os bots)

- **Iluminação base:** `HemisphereLight` + uma luz direcional (sol/refletor) garantindo o piso mínimo de brilho. Luzes UV e neon vêm por cima, como cor.
- **Pós-processamento:** `EffectComposer` com `UnrealBloomPass` **moderado** e com limiar alto (só o que é realmente neon brilha), leve aberração cromática e granulação. Nada de bloom que "lave" a tela.
- **Contorno dos jogadores:** passe de contorno (`OutlinePass` ou contorno por shader) sempre ligado nos jogadores.
- **Materiais:** paredes com `MeshStandardMaterial` em tom médio + mapa emissivo de pichação. A pichação brilha um pouco, a parede continua visível.
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
