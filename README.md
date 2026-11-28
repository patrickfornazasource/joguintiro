# LUZ NEGRA (nome provisório)

Movement shooter multiplayer no navegador, para 2 a 8 amigos, em subsolos e lugares abandonados tomados por pichação neon.

**Velocidade é munição. O coice é o motor. O mapa só se revela para quem corre.**

## Status

Fase 0 (Fundação) concluída, Fase 1 (Movimento) em andamento. Já existe uma tela 3D básica (chão cinza e um cubo), um servidor que liga junto com o jogo, leitura de teclado e mouse, e um painel de depuração (tecla F3). Ainda não dá para jogar: andar, pular e atirar vêm nas próximas tarefas.

## Como rodar no seu computador

Você só precisa fazer os passos 1 a 3 uma vez.

1. **Instale o Node.js.** Entre em [nodejs.org](https://nodejs.org), baixe a versão marcada como **LTS** e instale clicando em "Avançar" até o fim.
2. **Baixe o projeto.** Nesta página do GitHub, clique no botão verde **Code** e depois em **Download ZIP**. Descompacte o arquivo numa pasta fácil de achar, por exemplo na Área de Trabalho.
3. **Prepare o projeto.** Abra a pasta descompactada, clique com o botão direito num espaço vazio dentro dela e escolha **Abrir no Terminal**. Na janela que abrir, digite o comando abaixo e aperte Enter. Espere terminar (pode levar um minuto).

   ```
   npm install
   ```

4. **Ligue o jogo.** Na mesma janela, digite o comando abaixo e aperte Enter:

   ```
   npm run dev
   ```

   Vão aparecer mensagens com os nomes **servidor** e **cliente**. Deixe essa janela aberta enquanto joga.
5. **Abra o jogo.** No navegador (Chrome, Edge ou Firefox), entre em: http://localhost:5173
6. **Para desligar**, volte à janela do terminal e aperte **Ctrl + C**. Se perguntar algo, digite `S` e aperte Enter.

Da próxima vez, basta repetir os passos 3 (só a parte de abrir o terminal), 4 e 5. Se o projeto tiver sido atualizado, baixe de novo (passo 2) e rode `npm install` outra vez.

## Ajustar os números do movimento (painel F4)

Serve para testar outros valores de pulo, velocidade, deslize e afins sem mexer no código.

1. **Abra o jogo no modo ajuste:** http://localhost:5173/?ajuste=1 (funciona junto com o mapa de treino: http://localhost:5173/?mapa=treino&ajuste=1).
2. **Aperte F4** para abrir o painel (F4 de novo fecha). O mouse sai do jogo para você usar o painel.
   - Os valores estão em grupos: Chão, Pulo, Ar, Deslize, Parede, Slam, Dash, Plataformas e Corrimão. Clique no nome do grupo para abrir.
   - Cada linha mostra o nome, a unidade (m/s, s, m...) e o valor padrão. Arraste a barra ou digite um número.
   - Cada controle vai de um quarto até o triplo do valor padrão. Valores em amarelo estão diferentes do padrão. O botão ↺ da linha volta aquele valor ao padrão.
3. **Clique no jogo e teste.** A mudança vale na hora.
4. **Botões do alto do painel:**
   - **Restaurar padrão:** todos os valores voltam ao original;
   - **Salvar neste navegador:** os valores continuam quando você abrir o jogo de novo com `?ajuste=1`;
   - **Copiar valores:** copia um texto com o que você mudou (e o padrão de cada um). **Cole esse texto na conversa** para que os valores entrem no jogo de verdade.

Sem `?ajuste=1` no endereço, o painel não aparece e o jogo usa sempre os valores padrão. Se algum valor extremo jogar você por cima das paredes do mapa, você volta sozinho para a estação mais perto.

## Documentos

| Documento | Para quê |
|---|---|
| [GDD](docs/GDD.md) | Como o jogo funciona: regras, movimento, armas, modos, mapas. |
| [Estética](docs/ESTETICA.md) | Direção de arte neon, paleta e referências. |
| [Roadmap](docs/ROADMAP.md) | Todas as tarefas, fase por fase, com critérios de pronto. |
| [Automação](docs/AUTOMACAO.md) | Como os bots trabalham no projeto e onde você entra. |
| [OpenBot](docs/OPENBOT.md) | Instruções prontas para o gerente no OpenBot. |
| [Fichas de tarefa](docs/tarefas/README.md) | Uma ficha detalhada por tarefa, para cada bot executar. |
