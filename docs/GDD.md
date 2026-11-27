# LUZ NEGRA: Documento de Design (GDD)

> Nome provisório. Alternativas em aberto: **INÉRCIA**, **TAG RUSH**, **SUBSOLO**.
> Status: **rascunho v0.1, aguardando aprovação do dono do projeto.**

## 1. Resumo em uma frase

Movement shooter multiplayer no navegador, para 2 a 8 amigos, ambientado em subsolos pichados sob luz negra, onde **velocidade é munição**, **o coice das armas é o seu motor** e **o mapa só se revela para quem corre**.

## 2. Plataforma e público

| Item | Decisão |
|---|---|
| Plataforma | PC, navegador (Chrome, Edge, Firefox). Sem celular. |
| Controles | Teclado e mouse. |
| Jogadores por sala | 2 a 8. |
| Modos | Todos contra todos (FFA) e times (2 times). |
| Entrada | Link de convite. Sem cadastro obrigatório. |
| Tecnologia | Three.js (gráfico), Node.js + WebSocket (servidor). |

## 3. Os três pilares

Toda decisão de design deve reforçar pelo menos um pilar. Se uma ideia não reforça nenhum, ela fica de fora.

### Pilar 1: Velocidade é munição (Carga Cinética)

- Cada jogador tem uma barra de **Carga** (0 a 100).
- A Carga enche **com a velocidade horizontal**: acima da velocidade de caminhada, quanto mais rápido, mais rápido enche.
- Eventos de movimento dão bônus de Carga: pulo na parede, deslize longo, passar por um painel de Tinta UV.
- Parado, a Carga enche muito devagar (recarga mínima para ninguém ficar travado).
- **Atirar gasta Carga.** Sem Carga, sem tiro.
- **O dano do tiro escala com a sua velocidade no momento do disparo.** O mesmo tiro dado parado ou a 25 m/s causa danos muito diferentes.
- O HUD mostra a velocidade atual e o "dano do próximo tiro", para o jogador entender a regra sem tutorial.

**Efeito desejado:** campear é inútil, e o jogador habilidoso no movimento é literalmente mais letal.

### Pilar 2: O coice é o motor

- **Nada de mobilidade é de graça.** O **dash é um disparo da arma**: a arma estoura para trás e o coice te arremessa. Por isso ele **gasta a mesma Carga do tiro**. Cada dash é um tiro a menos.
- Todo disparo empurra o jogador na direção oposta à mira. Atirar para baixo te levanta; atirar para trás te acelera.
- **Disparo alternativo universal: Descarga.** Gasta toda a Carga de uma vez (mínimo 40) num impulso forte, que também causa dano em cone curto. É o "rocket jump" do jogo.
- Cada arma tem um coice com personalidade (ver seção 6).

**Efeito desejado:** a mesma decisão ("atiro agora?") é ao mesmo tempo de combate e de locomoção. Tensão constante entre gastar Carga para matar ou para fugir.

### Pilar 3: O mapa reage a quem corre (Tinta UV)

O conceito vem direto das referências: pichação que só aparece sob luz negra.

- Partes do mapa são pintadas com **Tinta UV**: invisíveis e intangíveis por padrão.
- Quem passa acima de uma velocidade limite emite uma **aura de luz negra**. Superfícies de Tinta UV dentro da aura **acendem e ficam sólidas por alguns segundos**: plataformas, rampas, paredes para pular, atalhos.
- Elas ficam sólidas **para todos**. Um jogador rápido abre caminho que outros podem usar (ou que vira armadilha quando apaga debaixo deles).
- Cada jogador deixa um **rastro de pichação** com a cor dele (ou do time) por onde passa em alta velocidade. O rastro some com o tempo.
- No modo de times, o rastro vira território (ver modo Pichação).

**Efeito desejado:** o mapa nunca é igual duas vezes; rotas aparecem e somem conforme o ritmo da partida.

## 4. Movimento (base de tudo)

**Referência de sensação pedida pelo dono do projeto: Titanfall 2 + Ultrakill.** Na prática:

- **Do Titanfall 2:** corrida na parede fluida e longa, deslize que conserva velocidade, encadear parede → pulo → parede sem tocar o chão, ritmo de "nunca parar".
- **Do Ultrakill:** dash curto e seco com cargas, golpe no chão (slam) e pulo de slam, deslize rápido, pulos na parede limitados que recarregam ao tocar o chão, agressividade (o jogo recompensa ir para cima do inimigo).

Usamos essas **mecânicas de gênero** como base; personagens, armas, visual e nomes são todos do LUZ NEGRA.

| Ação | Tecla | Comportamento |
|---|---|---|
| Andar | W A S D | Aceleração rápida no chão, atrito alto. |
| Pular | Espaço | Segurar = pulo automático ao tocar o chão (bunny hop). Pular no momento do pouso não perde velocidade. |
| **Pulo duplo** | Espaço no ar | Um pulo extra no ar (estilo Titanfall 2), permite mudar de direção. Recarrega ao tocar o chão ou correr numa parede. Grátis, não gasta Carga. |
| Controle aéreo | A/D + mouse | Virar o mouse no ar ajuda a curvar e ganhar velocidade (air strafe). |
| Deslizar | Ctrl ou C | Desliza com pouco atrito e impulso inicial. Pular durante o deslize mantém a velocidade (slide hop). |
| **Corrida na parede** | Pular em direção a uma parede de lado | Corre na parede por até ~1,5 s, quase sem cair, ganhando velocidade aos poucos. Gera Carga. Pular sai da parede em diagonal. |
| **Pulo na parede** | Espaço encostado numa parede no ar | Empurra para longe e para cima. **Máximo de 3 seguidos**; recarrega ao tocar o chão ou correr numa parede nova. |
| **Dash de coice** | Shift | A arma dispara um estouro na direção **oposta** às teclas apertadas e o coice te arremessa: arranco curto e seco, funciona no ar. **Custa Carga** (como um tiro). O estouro causa dano leve em quem estiver atrás de você. Cada arma tem um dash com sensação diferente (ver seção 6). |
| **Golpe no chão (slam)** | Ctrl/C no ar | Despenca em linha reta. Ao bater, empurra e causa dano em quem estiver perto. |
| **Pulo de slam** | Espaço logo após o slam tocar o chão | Pulo muito mais alto que o normal, proporcional à altura da queda. |
| Atirar | Botão esquerdo | Gasta Carga, dano escala com velocidade, empurra para trás. |
| Descarga | Botão direito | Gasta toda a Carga num impulso + dano em cone. |
| Placar | Tab | Mostra placar da partida. |

**Em aberto para decidir no Teste humano #1:** gancho (grapple). Fica fora da primeira versão para não haver ferramentas demais; entra se o movimento parecer "pobre".

Elementos de mapa que ajudam o movimento: **plataformas de salto** (te lançam para cima), **corrimãos** de escada para deslizar (referência 2 e 3), **paredes finas** para encadear pulos.

## 5. Loop de jogo

- **30 segundos:** correr para encher a Carga, achar alguém, decidir entre atirar (dano) ou usar o coice (posição), abrir rotas de Tinta UV no caminho.
- **5 minutos:** uma partida. Primeiro a 25 abates (FFA) ou time com mais pontos.
- **Sessão:** várias partidas na mesma sala com os amigos, trocando de modo e mapa.

## 6. Armas (proposta inicial)

Todas usam a mesma Carga. O jogador troca de arma com 1, 2, 3 ou roda do mouse.

| Arma | Tipo | Custo | Dano | Coice | Dash de coice (Shift) | Papel |
|---|---|---|---|---|---|---|
| **Rifle Cinético** | Tiro instantâneo, preciso | Baixo | Médio, escala forte com velocidade | Pequeno | Curto e rápido, pode encadear dois | Arma padrão, duelo a média distância |
| **Spray** | Escopeta de tinta, curto alcance | Médio | Alto de perto | Grande | Longo e forte, deixa nuvem de tinta para trás | Combate próximo e "shotgun jump" |
| **Lata** | Projétil de tinta que explode | Alto | Alto em área | Grande se explodir perto de você | Explosão atrás de você: o mais forte, porém o mais caro | Controle de área e lançamento vertical |
| **Descarga** | Disparo alternativo de qualquer arma | Toda a Carga | Cone curto | Enorme | (não se aplica) | Fuga, perseguição, finalização |

Números exatos serão ajustados em teste. Ponto de partida no arquivo de constantes do jogo.

## 7. Modos de jogo

1. **Todos contra todos (FFA):** 2 a 8 jogadores. Primeiro a 25 abates ou maior placar em 8 minutos.
2. **Times (TDM):** 2 times de até 4. Placar por abates do time.
3. **Pichação (times):** o rastro de cada jogador pinta zonas do mapa com a cor do time. Zonas pintadas pontuam com o tempo e dão Carga extra para quem é do time dono. Para pintar é preciso correr, então o modo recompensa o pilar 1.

## 8. Mapas (proposta)

Ambientação comum: casa noturna abandonada / subsolo urbano, luz negra, pichação fluorescente.

1. **Escadaria** (primeiro mapa): poços de escada interligados em vários níveis, corrimãos para deslizar, frases pichadas nos degraus (referência 3). Verticalidade forte.
2. **Pista**: antiga pista de dança, amplo e aberto, com plataformas de Tinta UV no alto. Bom para duelos de velocidade.
3. **Túnel**: corredores tipo metrô em loop, para velocidade máxima e o modo Pichação.

## 9. Direção de arte

Detalhada em [`ESTETICA.md`](ESTETICA.md). Resumo: escuro quase total, iluminação vinda de neon e da própria pichação, paleta roxo/azul ultravioleta com rosa, verde-limão e laranja fluorescentes, brilho forte (bloom), visual "bagunçado" com camadas de grafite sobre tudo.

## 10. Fora do escopo (por enquanto)

- Celular e controle de toque.
- Contas, loja, monetização.
- Matchmaking com desconhecidos (o foco é jogar com amigos por link).
- Mais de 8 jogadores por sala.

## 11. Riscos de design já mapeados

| Risco | Mitigação |
|---|---|
| Iniciantes ficam sem Carga e não conseguem jogar | Recarga mínima parada; ao renascer, começa com Carga cheia. |
| Jogadores experientes ficam rápidos demais e intocáveis | Velocidade máxima absoluta; dano recebido também empurra (perde controle). |
| Tinta UV confunde (plataforma some debaixo do pé) | Aviso visual de "piscar" 1 segundo antes de apagar. |
| Visual neon cansa a vista ou esconde inimigos | Inimigos com contorno de alto contraste; opção de reduzir brilho. |
| Online com atraso deixa o jogo injusto | Fase dedicada de netcode (ver roadmap, fase 8). |
