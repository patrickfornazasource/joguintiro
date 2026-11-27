# Instruções para agentes neste repositório

Projeto: **LUZ NEGRA**, movement shooter multiplayer no navegador (Three.js + Node.js).

## Leia antes de qualquer trabalho

1. `docs/GDD.md`: regras do jogo. É a fonte da verdade do design.
2. `docs/ROADMAP.md`: tarefas, dependências e critérios de aceite.
3. `docs/AUTOMACAO.md`: o ciclo que todo bot segue.
4. `docs/ESTETICA.md`: direção de arte (só se a tarefa for visual).

## Regras

- Faça **uma tarefa do roadmap por vez**, a primeira disponível da fase atual.
- Não avance de fase sem o marco 🧑 marcado como aprovado no roadmap.
- O dono do projeto **não programa**. PRs e mensagens para ele em português simples, sem jargão, com passos de teste numerados.
- Não use o travessão longo (caractere Unicode U+2014) em textos do projeto. Use dois-pontos, vírgula ou parênteses.
- Números de balanceamento só em `shared/constants.js`.
- Física e regras em `shared/` precisam ser código puro (sem Three.js, sem DOM) para rodar também no servidor.
- Sempre rode `npm test` e `npm run build` antes de abrir PR. Nunca desative testes.
- Mecânicas de gênero (corrida na parede, slam, bunny hop) são permitidas. Não copiar nomes, personagens, arte, sons ou mapas de jogos existentes.
