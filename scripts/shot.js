// Captura de tela automática do jogo.
// Uso: npm run shot [-- --url-params "?mapa=treino"] [-- --out nome.png] [-- --sem-clique]
// Por padrão, clica no jogo antes da foto (como uma pessoa: a tela "Clique para jogar" some).
// Com --sem-clique, fotografa a tela inicial.
// 1. Faz o build. 2. Sobe o vite preview numa porta livre.
// 3. Abre a página em 1280x720 e espera window.__READY === true (até 10 s).
// 4. Salva a imagem em artifacts/ e encerra tudo.
// Sai com código 1 se a página tiver erro no console ou exceção.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, preview } from 'vite';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const READY_TIMEOUT_MS = 10_000;
const VIEWPORT = { width: 1280, height: 720 };
const CLICK_SETTLE_MS = 400; // depois do clique, tempo para a tela inicial sumir e a imagem assentar

function parseArgs(argv) {
  const opts = { urlParams: '', out: 'shot.png', click: true };
  for (let i = 0; i < argv.length; i++) {
    const [key, inline] = argv[i].split(/=(.*)/s);
    const value = () => (inline !== undefined ? inline : argv[++i]);
    if (key === '--url-params') opts.urlParams = value() ?? '';
    else if (key === '--out') opts.out = value() ?? opts.out;
    else if (key === '--sem-clique') opts.click = false;
    else throw new Error(`Opção desconhecida: ${argv[i]}`);
  }
  if (opts.urlParams && !opts.urlParams.startsWith('?')) opts.urlParams = `?${opts.urlParams}`;
  // Só um nome de arquivo vai para artifacts/; um caminho é usado como está.
  opts.out = path.basename(opts.out) === opts.out
    ? path.join(ROOT, 'artifacts', opts.out)
    : path.resolve(ROOT, opts.out);
  return opts;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function launchBrowser() {
  // Primeiro o Chromium do Playwright; se não estiver instalado, Chrome ou Edge do computador.
  const attempts = [{}, { channel: 'chrome' }, { channel: 'msedge' }];
  const failures = [];
  for (const extra of attempts) {
    try {
      return await chromium.launch({ headless: true, ...extra });
    } catch (err) {
      failures.push(`${extra.channel || 'chromium'}: ${err.message.split('\n')[0]}`);
    }
  }
  throw new Error(
    `Nenhum navegador encontrado. Rode "npx playwright install chromium".\n  ${failures.join('\n  ')}`,
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const errors = [];
  let server;
  let browser;

  try {
    console.log('Fazendo o build...');
    await build({ root: ROOT, logLevel: 'warn' });

    const port = await freePort();
    server = await preview({
      root: ROOT,
      logLevel: 'warn',
      preview: { host: '127.0.0.1', port, strictPort: true, open: false },
    });
    const url = `http://127.0.0.1:${port}/${opts.urlParams}`;
    console.log(`Abrindo ${url}`);

    browser = await launchBrowser();
    const page = await browser.newPage({ viewport: VIEWPORT });
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`exceção: ${err.message}`));

    await page.goto(url, { waitUntil: 'load' });
    try {
      await page.waitForFunction(() => window.__READY === true, null, { timeout: READY_TIMEOUT_MS });
    } catch {
      console.warn(`Aviso: window.__READY não ficou true em ${READY_TIMEOUT_MS / 1000} s. Capturando mesmo assim.`);
    }

    if (opts.click) {
      // Clica no centro para entrar no jogo (some a tela inicial) e espera alguns quadros.
      await page.mouse.click(VIEWPORT.width / 2, VIEWPORT.height / 2);
      await page.waitForTimeout(CLICK_SETTLE_MS);
    }

    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    await page.screenshot({ path: opts.out });
    console.log(`Captura salva em ${path.relative(ROOT, opts.out)}`);
  } catch (err) {
    errors.push(`script: ${err.message}`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (server) await server.close().catch(() => {});
  }

  if (errors.length) {
    console.error(`\nFALHOU: ${errors.length} erro(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('OK: nenhum erro na página.');
  process.exit(0);
}

main();
