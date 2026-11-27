# Testes automáticos

Os testes conferem a lógica pura do jogo (pasta `shared/`) sem abrir o navegador. Os bots rodam `npm test` antes de abrir cada PR.

## Rodar

```bash
npm test
```

## Escrever um teste novo

1. Crie um arquivo nesta pasta com o nome `<assunto>.test.js` (ex.: `colisao.test.js`). Só arquivos terminados em `.test.js` são executados.
2. Use o executor nativo do Node, sem bibliotecas extras:

   ```js
   import { test } from 'node:test';
   import assert from 'node:assert/strict';
   import { len, v3 } from '../shared/math.js';

   test('comprimento de (3, 4, 0) é 5', () => {
     assert.equal(len(v3(3, 4, 0)), 5);
   });
   ```

3. Teste só código de `shared/` (sem Three.js, sem navegador).
4. Nunca apague ou desligue um teste para fazer o resto passar.
