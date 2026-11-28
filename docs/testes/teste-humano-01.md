# Teste humano #1: o movimento é gostoso?

Leva uns 10 minutos. Você joga o mapa de treino e responde 9 perguntas.

## 1. Ligar o jogo

1. Na pasta do projeto, abra o terminal e rode `npm install` (só da primeira vez).
2. Rode `npm run dev` e deixe a janela aberta.
3. No navegador, abra **http://localhost:5173/?mapa=treino&ajuste=1**.
4. Clique na tela para jogar. Esc solta o mouse.

## 2. Teclas

- **W A S D:** andar. **Mouse:** olhar.
- **Espaço:** pular. Segure para emendar pulos. Aperte de novo no ar para o pulo duplo.
- **C ou Ctrl:** correndo, desliza. No ar, faz o slam (golpe no chão).
- **Shift:** dash.
- **R:** volta para a estação mais perto.
- **F4:** painel para ajustar os números. **F3:** painel de informações.

## 3. Roteiro (siga as placas)

Cada estação tem uma placa. Faça na ordem, de 1 a 10.

1. **Bunny hop:** segure W e Espaço.
2. **Air strafe:** pule o buraco curvando para a direita (D e mouse).
3. **Deslize:** corra e aperte C antes do túnel baixo.
4. **Corrida na parede:** pule de lado numa parede. **Novidade:** vale em qualquer parede, cinza ou ciano.
5. **Pulo na parede:** suba o poço pulando de uma parede para a outra.
6. **Slam:** do alto da torre, C no X amarelo. Ao bater, Espaço e Espaço no ar.
7. **Dash:** pulo, pulo duplo e Shift para cruzar o vão.
8. **Plataformas:** pise na verde e deixe ela lançar você.
9. **Corrimão:** suba a escada com W e, no alto, puxe D. **Novidade:** o corrimão não freia mais. Entre rápido e veja.
10. **Circuito:** saia da faixa verde, dê a volta toda e pare na vermelha. O tempo fica no alto da tela.

Errou? Aperte **R**. Quer repetir uma estação? Use `&spawn=N` no endereço (N de 1 a 10).

## 4. Perguntas (responda sim ou não e diga o que faltou)

1. O pulo é bom?
2. O bunny hop é bom?
3. O air strafe (curvar no ar) é bom?
4. O deslize é bom?
5. A corrida na parede é boa?
6. O pulo na parede é bom?
7. O slam é bom?
8. O dash é bom?
9. **Decisão:** falta um gancho (grapple), ou o movimento já basta?

## 5. Ajustar e devolver

- **Achou algo forte ou fraco demais?** Aperte F4, mude o número e teste na hora. ↺ volta ao padrão.
- **Gostou dos números?** Clique em **Copiar valores** e cole na resposta.
- **A câmera travou?** Abra com `?mapa=treino&debug=1`, aperte F3 e diga o que mostram "mouse (movimentos/s)" e "mouse travado". Diga também se usa touchpad ou mouse.
- **Para responder:** escreva no próprio relatório do OpenBot (as 9 respostas e, se tiver, os valores copiados).
