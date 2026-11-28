// Tela inicial: "Clique para jogar" e as teclas. Some quando o mouse trava no jogo
// e volta quando solta (Esc).

const CONTROLS = [
  ['W A S D', 'andar'],
  ['Espaço', 'pular (segure para emendar; de novo no ar: pulo duplo)'],
  ['A/D + mouse no ar', 'curvar e ganhar velocidade'],
  ['C ou Ctrl', 'agachar; correndo: deslizar; no ar: golpe no chão'],
  ['Espaço logo depois do golpe', 'pulo de slam (mais alto quanto maior a queda)'],
  ['Shift', 'dash para o lado das teclas (3 cargas, provisório)'],
  ['Pular de lado numa parede ciano', 'correr na parede (Espaço sai dela)'],
  ['Espaço encostado numa parede no ar', 'pulo na parede (até 3 seguidos)'],
  ['Mouse', 'olhar'],
  ['F3', 'painel de informações'],
  ['Esc', 'soltar o mouse'],
];

/**
 * Cria a tela inicial sobre o jogo.
 * @param {{ canvas: HTMLCanvasElement, doc?: Document }} opts
 */
export function createStartScreen({ canvas, doc = document }) {
  const el = doc.createElement('div');
  el.id = 'start-screen';
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.35)',
    cursor: 'pointer',
    zIndex: '5',
    font: '16px/1.5 system-ui, sans-serif',
    color: '#f0f0f0',
  });

  const box = doc.createElement('div');
  Object.assign(box.style, {
    padding: '24px 32px',
    background: 'rgba(10, 10, 16, 0.85)',
    border: '1px solid #00e5ff',
    borderRadius: '8px',
    textAlign: 'center',
  });
  const title = doc.createElement('div');
  title.textContent = 'LUZ NEGRA';
  Object.assign(title.style, { fontSize: '28px', fontWeight: '700', letterSpacing: '4px' });
  const cta = doc.createElement('div');
  cta.textContent = 'Clique para jogar';
  Object.assign(cta.style, { margin: '8px 0 16px', fontSize: '20px', color: '#00e5ff' });
  const list = doc.createElement('div');
  list.style.fontSize = '14px';
  list.style.opacity = '0.85';
  list.textContent = CONTROLS.map(([k, v]) => `${k}: ${v}`).join('   ·   ');
  box.append(title, cta, list);
  el.append(box);
  doc.body.appendChild(el);

  const isLocked = () => doc.pointerLockElement === canvas;
  const sync = () => {
    el.style.display = isLocked() ? 'none' : 'flex';
  };
  // A tela fica por cima do jogo, então o clique nela é que pede a trava do mouse.
  // O Chrome recusa a trava logo após o Esc (e rejeita a promessa): ignorar sem erro.
  el.addEventListener('click', () => canvas.requestPointerLock?.()?.catch?.(() => {}));
  doc.addEventListener('pointerlockchange', sync);
  sync();

  return {
    el,
    get visible() {
      return el.style.display !== 'none';
    },
  };
}
