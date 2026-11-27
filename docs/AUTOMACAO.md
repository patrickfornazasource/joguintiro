# Automação: bots trabalhando no projeto

Objetivo: agentes de IA executam o roadmap continuamente, uma tarefa por vez, e o dono do projeto entra só para **testar e aprovar**.

## O ciclo de cada bot

1. **Ler** `CLAUDE.md`, `docs/GDD.md` e `docs/ROADMAP.md`.
2. **Escolher** a primeira tarefa `[ ]` do roadmap cujas dependências estão `[x]`, **na fase atual**, e ler a ficha dela em `docs/tarefas/<código>.md`. Nunca pular para uma fase cujo marco com 🧑 ainda não foi aprovado. Sem ficha, não executa: pede ao coordenador para detalhar.
3. **Marcar** a tarefa como `[~]` com o nome do branch.
4. **Implementar** num branch próprio (`bot/F1-05-air-strafe`).
5. **Verificar:** `npm test`, `npm run build` e, se mexeu no visual, `npm run shot` (captura de tela anexada ao PR).
6. **Abrir PR** com: o que foi feito, como testar em 3 passos simples (sem jargão), captura de tela, e o critério "Pronto quando" marcado.
7. **Parar.** Um bot nunca aprova nem mescla o próprio PR.

## Papéis

| Papel | Quem | Faz o quê |
|---|---|---|
| Dono do projeto | Você | Joga, aprova marcos 🧑, decide o que fica e o que sai do GDD. |
| Gerente | OpenBot | Acompanha o roadmap, escolhe a próxima tarefa, faz relatórios, chama o dono nos testes humanos. |
| Executor | Claude Code | Pega uma tarefa, implementa, testa, abre PR. Também mantém GDD e roadmap quando o dono pede mudanças. |

## Regras de segurança do processo

- **Uma tarefa por PR.** PR pequeno é fácil de revisar e de desfazer.
- **Nada vai para o `main` sem revisão.** Os PRs dos executores passam pelo relatório do gerente e o dono aprova a mesclagem.
- **Nenhum bot muda o GDD** sozinho. Se achar que uma regra de design não funciona, abre uma issue com a proposta.
- **Testes nunca são apagados ou desligados** para fazer o CI passar.
- **Constantes de balanceamento** só mudam em PR próprio, com justificativa.
- **Nomes de constantes:** nomes em camelCase das fichas viram MAIÚSCULAS_COM_SUBLINHADO em `shared/constants.js` (ex.: `groundAccel` vira `GROUND_ACCEL`). Decisão da gerência, vale da F1 em diante.
- **Custo:** cada execução de bot consome uso da sua assinatura. Começar com poucas execuções por dia e aumentar se o ritmo de revisão acompanhar. Bot rodando sem parar produz PRs mais rápido do que alguém consegue testar.

## Ritmo sugerido

| Fase do projeto | Frequência dos bots | Por quê |
|---|---|---|
| F0 a F2 | 2 a 3 execuções por dia | O movimento precisa do seu teste a cada poucos dias. |
| F3 a F6 | 4 a 6 execuções por dia | Muitas tarefas independentes (arte, mapas, rede). |
| F7 em diante | Conforme necessidade | Polimento depende de feedback de partidas reais. |

## Decisões do dono

| Data | Decisão |
|---|---|
| 27/11/2026 | Testes locais por enquanto (`npm run dev`). Hospedagem online (F0-11) adiada. |

## Plataforma dos bots

- **Gerente:** OpenBot, com rotinas agendadas. Instruções prontas para colar em [`OPENBOT.md`](OPENBOT.md).
- **Executor:** Claude Code, trabalhando direto neste repositório.
