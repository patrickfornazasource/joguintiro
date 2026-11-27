# Fichas de tarefa

Cada arquivo desta pasta é **uma tarefa para um bot**: objetivo, passo a passo, arquivos, critérios de pronto, como verificar e o pedido pronto para colar.

Regra de detalhamento: só as fases **atual e seguinte** ficam detalhadas em fichas. As outras continuam como itens do `ROADMAP.md` e são detalhadas quando a fase anterior termina, porque dependem do que for aprendido (código existente, resultado dos testes humanos). Essa é a tarefa de fechamento de cada fase (`Fx-99`).

## Fase 0: Fundação

| Ficha | Tarefa | Depende de | Tamanho |
|---|---|---|---|
| [F0-01](F0-01.md) | Estrutura do projeto e cena 3D vazia | (nenhuma) | P |
| [F0-02](F0-02.md) | Servidor mínimo com WebSocket | F0-01 | P |
| [F0-03](F0-03.md) | Comando único para rodar tudo | F0-02 | P |
| [F0-04](F0-04.md) | Pasta shared e constantes centralizadas | F0-01 | P |
| [F0-05](F0-05.md) | Testes automáticos de lógica | F0-04 | P |
| [F0-06](F0-06.md) | Captura de tela automática | F0-01 | M |
| [F0-07](F0-07.md) | Verificação automática no GitHub (CI) | F0-05, F0-06 | P |
| [F0-08](F0-08.md) | Laço do jogo com passo fixo | F0-04, F0-05 | P |
| [F0-09](F0-09.md) | Leitura de teclado e mouse | F0-08 | P |
| [F0-10](F0-10.md) | Painel de depuração (F3) | F0-09 | P |
| [F0-11](F0-11.md) | Versão de teste por link | F0-07 | M |

## Fase 1: Movimento

| Ficha | Tarefa | Depende de | Tamanho |
|---|---|---|---|
| [F1-01](F1-01.md) | Formato de mapa e mapa cinza inicial | F0-04 | M |
| [F1-02](F1-02.md) | Estado do jogador e gravidade | F0-04, F0-05 | P |
| [F1-03](F1-03.md) | Colisão com o cenário | F1-01, F1-02 | M |
| [F1-04](F1-04.md) | Subir degraus andando | F1-03 | P |
| [F1-05](F1-05.md) | Câmera em primeira pessoa e andar pelo mapa | F0-09, F1-04 | M |
| [F1-06](F1-06.md) | Aceleração no chão e atrito | F1-05 | P |
| [F1-07](F1-07.md) | Pulo, bunny hop e tolerância de borda | F1-06 | P |
| [F1-08](F1-08.md) | Controle aéreo (air strafe) | F1-07 | P |
| [F1-09](F1-09.md) | Pulo duplo | F1-07 | P |
| [F1-10](F1-10.md) | Deslize e slide hop | F1-07 | M |
| [F1-11](F1-11.md) | Detector de parede | F1-03 | P |
| [F1-12](F1-12.md) | Corrida na parede | F1-08, F1-09, F1-11 | G |
| [F1-13](F1-13.md) | Pulo na parede | F1-07, F1-11 | P |
| [F1-14](F1-14.md) | Golpe no chão (slam) e pulo de slam | F1-10 | M |
| [F1-15](F1-15.md) | Dash provisório | F1-07 | P |
| [F1-16](F1-16.md) | Plataformas de salto | F1-07 | P |
| [F1-17](F1-17.md) | Corrimão deslizável | F1-10 | M |
| [F1-18](F1-18.md) | Sensação de velocidade e velocímetro | F1-12, F1-14, F1-15 | M |
| [F1-19](F1-19.md) | Mapa de treino com estações | F1-12, F1-13, F1-14, F1-16, F1-17 | M |
| [F1-20](F1-20.md) | Painel de ajuste ao vivo (F4) | F1-18 | M |
| [F1-21](F1-21.md) | Roteiro do Teste humano #1 | F1-19, F1-20, F0-11 | P |

## Ordem e paralelismo

Tarefas sem dependência entre si podem ser feitas por bots diferentes ao mesmo tempo. Ondas sugeridas:

| Onda | Tarefas (podem rodar em paralelo) |
|---|---|
| 1 | F0-01 |
| 2 | F0-02, F0-04, F0-06 |
| 3 | F0-03, F0-05 |
| 4 | F0-07, F0-08, F1-02 |
| 5 | F0-09, F0-11, F1-01 |
| 6 | F0-10, F1-03 |
| 7 | F1-04, F1-11 |
| 8 | F1-05 |
| 9 | F1-06 |
| 10 | F1-07 |
| 11 | F1-08, F1-09, F1-10, F1-13, F1-15, F1-16 |
| 12 | F1-12, F1-14, F1-17 |
| 13 | F1-18, F1-19 |
| 14 | F1-20 |
| 15 | F1-21 (fim da fase: Teste humano #1) |

**Recomendação para começar:** uma tarefa por vez, em sequência, até a Fase 0 terminar. Paralelismo só depois que o processo de revisão estiver rodando bem.
