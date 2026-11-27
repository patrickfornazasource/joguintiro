# Roadmap: LUZ NEGRA

Plano completo do projeto, do repositório vazio ao jogo no ar para os amigos.

## Como ler este arquivo

- O projeto tem **11 fases** (F0 a F10). Cada fase termina num **marco**.
- Cada fase tem **tarefas** com código (ex.: `F1-03`). Cada tarefa cabe numa sessão de trabalho de um bot.
- **Depende de:** tarefas que precisam estar prontas antes.
- **Pronto quando:** critério objetivo de aceite. Sem isso cumprido, a tarefa não está pronta.
- 🧑 **Teste humano:** marcos que só o dono do projeto pode aprovar, porque "é divertido?" não se verifica por script. **Nenhum bot avança para a fase seguinte sem esse aval.**

Status possíveis: `[ ]` a fazer, `[~]` em andamento, `[x]` pronto.

---

## F0: Fundação

Objetivo: projeto que roda no navegador com um comando, com testes automáticos que os bots usam para se verificar.

- [ ] **F0-01 Estrutura do projeto.** Vite + Three.js no cliente, Node.js + `ws` no servidor, pasta `shared/` com código usado pelos dois. Scripts `npm run dev`, `npm run build`, `npm start`.
  Pronto quando: `npm install && npm run dev` abre uma cena 3D vazia no navegador e o servidor responde na porta 8787.
- [ ] **F0-02 Constantes de jogo centralizadas.** Arquivo `shared/constants.js` com todos os números de movimento, Carga e armas.
  Depende de: F0-01. Pronto quando: nenhum número de balanceamento aparece "solto" fora desse arquivo.
- [ ] **F0-03 Teste visual automático.** Script com Playwright que abre o jogo, espera carregar e salva captura de tela em `artifacts/`.
  Depende de: F0-01. Pronto quando: `npm run shot` gera a imagem sem erro no console.
- [ ] **F0-04 Testes de lógica.** Configurar `node --test` para testar física e regras sem navegador.
  Depende de: F0-01. Pronto quando: `npm test` roda e passa com pelo menos um teste.
- [ ] **F0-05 CI no GitHub.** Workflow que roda `npm test` e `npm run build` em todo PR.
  Depende de: F0-04. Pronto quando: PR mostra o check verde.
- [ ] **F0-06 Página de depuração.** Tecla F3 mostra FPS, posição, velocidade, Carga, estado de rede.
  Depende de: F0-01.

**Marco F0:** tela 3D abre, testes rodam, CI ativo.

---

## F1: Movimento (o coração)

Objetivo: correr, pular e deslizar precisa ser gostoso **antes** de existir tiro.

- [ ] **F1-01 Física do jogador em `shared/physics.js`.** Código puro (sem Three.js) para rodar igual no cliente e no servidor. Passo fixo de 1/120 s.
- [ ] **F1-02 Colisão com caixas.** Jogador como caixa (AABB) contra o cenário, resolvendo eixo a eixo. Subir degraus de até 0,45 m sem pular.
  Pronto quando: teste prova que o jogador não atravessa paredes a 40 m/s e sobe escadas andando.
- [ ] **F1-03 Câmera em primeira pessoa.** Pointer lock, sensibilidade ajustável e salva no navegador.
- [ ] **F1-04 Aceleração no chão e atrito.**
- [ ] **F1-05 Air strafe.** Controle aéreo que permite ganhar velocidade virando o mouse com A/D.
  Pronto quando: teste automático mostra ganho de velocidade em 10 pulos seguidos com strafe ideal.
- [ ] **F1-06 Bunny hop.** Segurar espaço pula ao tocar o chão sem perder velocidade por atrito.
- [ ] **F1-07 Deslize.** Ctrl/C; impulso inicial; pulo durante deslize mantém velocidade (slide hop); câmera abaixa.
- [ ] **F1-08 Corrida na parede (estilo Titanfall 2).** Detecção de parede lateral, gravidade reduzida, duração máxima, ganho leve de velocidade, câmera inclina para o lado oposto à parede.
  Pronto quando: teste automático percorre um corredor de paredes alternadas (parede → pulo → parede) sem tocar o chão.
- [ ] **F1-09 Pulo na parede (estilo Ultrakill).** Janela de tolerância de 0,15 s; máximo de 3 seguidos; recarga ao tocar o chão.
- [ ] **F1-09a Pulo duplo.** Um pulo extra no ar; recarrega no chão ou na parede.
- [ ] **F1-09d Dash de coice (versão provisória).** Shift arremessa na direção das teclas. Nesta fase usa 3 cargas com recarga por tempo; em **F2-12** passa a ser um disparo de arma que gasta Carga.
- [ ] **F1-09b Golpe no chão e pulo de slam.** Queda rápida; pulo de slam proporcional à altura da queda.
- [ ] **F1-09c Plataformas de salto.**
- [ ] **F1-10 Corrimão deslizável.** Encostar num corrimão em deslize "trava" nele e acelera na descida.
- [ ] **F1-11 Sensação de velocidade.** FOV dinâmico, inclinação de câmera, velocímetro no HUD.
- [ ] **F1-12 Mapa cinza de testes.** Arena simples com escadas, paredes finas, plataformas e corrimãos (sem arte).

**Marco F1 🧑 Teste humano #1:** o dono do projeto corre pelo mapa cinza por 10 minutos e responde: "o movimento é gostoso?". Ajustes de constantes até a resposta ser sim.

---

## F2: Combate e Carga Cinética

- [ ] **F2-01 Sistema de Carga.** Enche com velocidade e eventos (pulo na parede, deslize). Regras do GDD, seção 3.
  Pronto quando: testes cobrem ganho parado, ganho em alta velocidade e bônus.
- [ ] **F2-02 Rifle Cinético.** Tiro instantâneo (raycast), custo de Carga, dano escala com velocidade, coice.
- [ ] **F2-03 Descarga (disparo alternativo).** Gasta toda a Carga, impulso proporcional, dano em cone.
- [ ] **F2-04 HUD de combate.** Barra de Carga dividida em "tiros disponíveis", vida, "dano do próximo tiro", marcador de acerto.
- [ ] **F2-05 Alvos treináveis (bots offline).** Bonecos que andam e pulam para treinar sozinho.
- [ ] **F2-06 Spray (escopeta).**
- [ ] **F2-07 Lata (projétil explosivo).** Projétil com física, explosão com dano em área e empurrão.
- [ ] **F2-08 Troca de armas.** 1/2/3 e roda do mouse.
- [ ] **F2-09 Morte e renascimento.** Pontos de nascimento longe dos inimigos; renasce com Carga cheia.
- [ ] **F2-10 Arma na tela (viewmodel).** Modelo simples, animação de coice, brilho pela Carga.
- [ ] **F2-11 Sons sintetizados.** Tiro, acerto, pulo, deslize, plataforma de salto (Web Audio, sem arquivos).
- [ ] **F2-12 Dash de coice definitivo.** O dash vira disparo da arma atual na direção oposta ao movimento: gasta Carga, causa dano leve atrás, força e efeito diferentes por arma (tabela do GDD, seção 6).
  Depende de: F1-09d, F2-01, F2-06, F2-07.

**Marco F2 🧑 Teste humano #2:** contra os alvos, o jogador sente que "correr = mais dano" e usa o coice para se mover sem ninguém explicar?

---

## F3: Multiplayer básico

- [ ] **F3-01 Servidor de salas.** Conexão WebSocket, entrar, sair, lista de jogadores.
- [ ] **F3-02 Sincronização de posição.** Cliente envia estado 20x/s; servidor repassa a todos.
- [ ] **F3-03 Interpolação.** Outros jogadores desenhados 100 ms no passado, suavemente.
- [ ] **F3-04 Modelo do jogador remoto.** Corpo, cabeça, cor, nome flutuante.
- [ ] **F3-05 Tiros e dano pela rede.** Servidor valida limites (dano máximo, cadência, distância) e decide mortes.
- [ ] **F3-06 Empurrão ao levar dano.**
- [ ] **F3-07 Placar (Tab) e feed de abates.**
- [ ] **F3-08 Link de convite.** `?sala=abc123` coloca todos na mesma sala.
- [ ] **F3-09 Teste de carga.** Script que conecta 8 clientes falsos e mede uso de CPU e banda do servidor.
  Pronto quando: 8 jogadores simulados por 10 minutos sem erro e com banda < 50 KB/s por jogador.
- [ ] **F3-10 Hospedagem de teste.** Servidor publicado num serviço na nuvem para jogar com amigos de verdade.

**Marco F3 🧑 Teste humano #3:** primeira partida real com 2 a 4 amigos.

---

## F4: Mapa reativo (Tinta UV)

- [ ] **F4-01 Aura de luz negra.** Raio que cresce com a velocidade acima do limite.
- [ ] **F4-02 Superfícies de Tinta UV.** Inativas: invisíveis e sem colisão. Na aura: ficam sólidas por N segundos, para todos.
- [ ] **F4-03 Sincronização da Tinta UV pelo servidor.** O servidor é dono do estado (ativa/inativa) para não haver divergência.
- [ ] **F4-04 Aviso antes de apagar.** Pisca 1 s antes.
- [ ] **F4-05 Rastro de pichação.** Jogadores rápidos deixam rastro colorido que some com o tempo.
- [ ] **F4-06 Bônus de Carga ao ativar Tinta UV.**
- [ ] **F4-07 Ferramenta de posicionamento.** Formato de dados de mapa que permita marcar quais blocos são Tinta UV.

**Marco F4 🧑 Teste humano #4:** as rotas que aparecem e somem deixam a partida mais interessante ou só confusa?

---

## F5: Direção de arte neon

Seguir [`ESTETICA.md`](ESTETICA.md).

- [ ] **F5-01 Pós-processamento.** Bloom, aberração cromática leve, granulação. Opção de qualidade.
- [ ] **F5-02 Gerador de pichação procedural.** Texturas de tags, letras, escorridos e respingos em Canvas 2D com semente.
- [ ] **F5-03 Frases nos degraus.** Texto pintado em escadas (referência 3).
- [ ] **F5-04 Materiais de subsolo.** Tijolo, concreto, metal escuro, com pichação emissiva por cima.
- [ ] **F5-05 Tubos de LED e lâmpadas pontuais.**
- [ ] **F5-06 Shader da Tinta UV.** Acende a partir do ponto de contato, cintila, pisca antes de apagar.
- [ ] **F5-07 Efeitos de tiro.** Rastro de tinta, faíscas, marcas de impacto como decalque.
- [ ] **F5-08 Visual dos jogadores.** Silhueta legível com contorno de alto contraste, cor por jogador/time.
- [ ] **F5-09 Linhas de velocidade e efeitos de câmera.**
- [ ] **F5-10 Desempenho.** 60 FPS em vídeo integrado na qualidade baixa.
  Pronto quando: script de benchmark com Playwright registra FPS médio em cena cheia.

- [ ] **F5-11 Testes de visibilidade automáticos.** Script que tira capturas em vários pontos do mapa, converte para cinza, mede brilho médio e contraste do jogador contra o fundo. Falha se algum ponto ficar abaixo do mínimo.

**Marco F5 🧑 Teste humano #5:** capturas de tela comparadas com as referências. "Tem a energia daquele lugar e ainda dá para ver todo mundo?"

---

## F6: Mapas definitivos

- [ ] **F6-01 Mapa Escadaria.** Poços de escada em vários níveis, corrimãos, frases nos degraus.
- [ ] **F6-02 Mapa Galpão.** Fábrica abandonada, telhado furado, passarelas, Tinta UV no alto.
- [ ] **F6-03 Mapa Metrô.** Estação desativada com túneis em loop para velocidade máxima.
- [ ] **F6-04 Pontos de nascimento e testes de fluxo.** Script que simula bots andando e gera "mapa de calor" de onde as pessoas passam.

---

## F7: Modos de jogo e salas

- [ ] **F7-01 Ciclo de partida.** Aquecimento, partida com tempo/limite, tela de fim, próxima partida.
- [ ] **F7-02 FFA.**
- [ ] **F7-03 Times (TDM).** Escolha/balanceamento de times, cores Rosa x Verde.
- [ ] **F7-04 Modo Pichação.** Zonas pintáveis pelo rastro, pontuação por tempo.
- [ ] **F7-05 Lobby da sala.** Dono escolhe modo e mapa; lista de jogadores; botão "copiar convite".
- [ ] **F7-06 Tela inicial.** Nome, cor, sensibilidade, qualidade gráfica, volume.

**Marco F7 🧑 Teste humano #6:** noite de jogo com 6 a 8 amigos, todos os modos.

---

## F8: Netcode sério

Necessário para ficar justo com atraso de internet e evitar trapaça básica.

- [ ] **F8-01 Servidor autoritativo.** Servidor roda a mesma física de `shared/physics.js` com as entradas dos clientes.
- [ ] **F8-02 Predição no cliente e reconciliação.** Movimento responde na hora; correções do servidor são suaves.
- [ ] **F8-03 Compensação de atraso nos tiros.** Servidor "volta no tempo" para conferir acertos.
- [ ] **F8-04 Simulador de rede ruim.** Modo de teste com atraso e perda de pacotes artificiais.
- [ ] **F8-05 Mensagens binárias.** Reduzir banda trocando JSON por formato binário.
- [ ] **F8-06 Proteções básicas.** Limite de velocidade, cadência e mensagens por segundo no servidor.

---

## F9: Lançamento para os amigos

- [ ] **F9-01 Hospedagem 24h.** Servidor sempre ligado, com reinício automático em caso de erro.
- [ ] **F9-02 Domínio e HTTPS.**
- [ ] **F9-03 Monitoramento.** Registro de erros e aviso quando o servidor cai.
- [ ] **F9-04 Trilha sonora e mixagem final.**
- [ ] **F9-05 Tutorial curto.** Mapa de treino guiado: movimento, Carga, coice, Tinta UV.
- [ ] **F9-06 Página de configurações completa.** Teclas, sensibilidade, FOV, acessibilidade (reduzir brilho e piscadas).

**Marco F9 🧑 Lançamento:** link fixo enviado para o grupo de amigos.

---

## F10: Depois do lançamento (ideias para o futuro)

- Editor de tag: cada jogador desenha a própria pichação, que aparece no rastro e no mapa.
- Mais armas com coices diferentes (ex.: arma que puxa em vez de empurrar).
- Replays e "melhores momentos" automáticos.
- Editor de mapas no navegador.
- Desafios de velocidade contra o relógio (modo solo).
- Versão desktop instalável (aplicativo) usando a mesma base web.
