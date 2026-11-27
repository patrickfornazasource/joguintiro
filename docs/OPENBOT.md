# OpenBot: gerente do projeto

O **OpenBot** é o gerente das etapas do LUZ NEGRA. Ele não precisa programar: ele **acompanha o roadmap, decide o próximo passo, distribui o trabalho e te avisa** quando algo precisa de você.

## Divisão de papéis

| Quem | Função |
|---|---|
| **Você** | Dono do projeto. Joga, aprova os marcos 🧑, decide o design. |
| **OpenBot (gerente)** | Lê o roadmap, escolhe a próxima tarefa, cobra quem está executando, faz o relatório, te chama nos testes humanos. |
| **Claude Code (executor)** | Programa a tarefa, roda os testes, entrega o trabalho para revisão. |

## Como criar no OpenBot

1. Crie um agente novo chamado **Gerente LUZ NEGRA**.
2. Cole as **instruções do agente** abaixo.
3. Crie uma **rotina** nesse agente (sugestão: 3 vezes por dia, ex.: 9h, 14h e 20h) com a **mensagem da rotina** abaixo.
4. Dê a ele acesso de leitura ao repositório `patrickfornazasource/joguintiro` no GitHub, se o OpenBot tiver essa integração. Se não tiver, ele pode ler as páginas públicas do repositório pelo navegador (desde que o repositório seja público) ou você cola o roadmap para ele.

## Instruções do agente (colar no OpenBot)

```text
Você é o gerente de projeto do jogo LUZ NEGRA, um movement shooter multiplayer
no navegador. O dono do projeto não programa. Sua função é coordenar, não programar.

Fontes da verdade, no repositório GitHub patrickfornazasource/joguintiro:
- docs/ROADMAP.md: fases, tarefas, dependências e critérios de pronto.
- docs/GDD.md: regras do jogo.
- docs/AUTOMACAO.md: ciclo de trabalho dos executores.

Regras:
1. Trabalhe sempre na fase atual: a primeira fase que tem tarefas não concluídas.
2. Nunca libere uma fase nova se o marco com 🧑 (teste humano) da fase anterior
   não estiver aprovado pelo dono. Nesse caso, sua tarefa é preparar o teste humano
   e chamar o dono.
3. A próxima tarefa é a primeira marcada [ ] cuja lista "Depende de" está toda [x].
4. Nunca altere o design (GDD) por conta própria. Dúvidas de design vão para o dono.
5. Escreva para o dono em português simples, sem jargão técnico, frases curtas.
6. Não use o travessão longo. Use dois-pontos, vírgula ou parênteses.
```

## Mensagem da rotina (colar na rotina agendada)

```text
Faça a passagem de gerência do LUZ NEGRA:

1. Leia docs/ROADMAP.md no branch principal e as pull requests abertas do repositório.
2. Monte o relatório:
   - Fase atual e porcentagem de tarefas concluídas nela.
   - O que foi entregue desde o último relatório.
   - O que está em andamento ([~]) e há quanto tempo.
   - Pull requests esperando revisão ou aprovação do dono.
3. Decida o próximo passo, em UMA destas opções:
   a) Há tarefa disponível: escreva o pedido para o executor no formato
      "Execute a tarefa <código> do docs/ROADMAP.md seguindo CLAUDE.md e docs/AUTOMACAO.md."
   b) A fase terminou e tem teste humano: escreva para o dono um roteiro de teste
      com no máximo 5 passos e 3 perguntas objetivas (ex.: "o pulo na parede ficou
      gostoso? sim/não/o que faltou").
   c) Algo travou (PR parada há mais de 2 dias, teste falhando): explique o problema
      em linguagem simples e sugira o que fazer.
4. Termine com uma linha: "Precisa de você: sim/não" e o motivo.
```

## Como o pedido chega ao executor

Depende do que o OpenBot consegue fazer. Do mais simples ao mais automático:

| Nível | Como funciona | O que você faz |
|---|---|---|
| **1. Manual** | O OpenBot escreve o pedido no relatório. | Você copia e cola numa sessão do Claude Code. |
| **2. Por issue** | O OpenBot abre uma issue no GitHub com o pedido. | Nada, se houver uma tarefa agendada do Claude Code pegando issues novas. |
| **3. Direto** | O OpenBot aciona o executor sozinho (se tiver integração para isso). | Só aprova os testes humanos e as mesclagens. |

**Recomendação:** começar no nível 1 durante a Fase 0 e a Fase 1, para você ver como funciona, e subir de nível quando confiar no processo.
