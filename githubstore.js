// Backup das contas no GitHub (alternativa ao Firebase, sem chave do Google).
// Guarda o banco inteiro, comprimido, num arquivo de um repositório PRIVADO seu.
// Variáveis: GITHUB_TOKEN, GITHUB_REPO ("usuario/repositorio"), GITHUB_BRANCH (opcional), GITHUB_DATA_PATH (opcional).
import zlib from 'node:zlib';
import crypto from 'node:crypto';

export function createGithubStore(opts = {}) {
  const token = String(opts.token || '').trim();
  const repo = String(opts.repo || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  const branch = String(opts.branch || '').trim() || 'main';
  const filePath = String(opts.path || '').trim() || 'universo-dados.json.gz';
  const api = String(opts.apiBase || 'https://api.github.com').replace(/\/+$/, '');
  const log = opts.log || console;
  const minGap = opts.minGapMs ?? 90000;      // intervalo entre backups comuns
  const urgentGap = opts.urgentGapMs ?? 15000; // intervalo entre backups urgentes (conta criada, senha etc.)
  const enabled = !!token && /^[\w.-]+\/[\w.-]+$/.test(repo);

  const url = `${api}/repos/${repo}/contents/${filePath.split('/').map(encodeURIComponent).join('/')}`;
  const baseHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'universo-chat-backup',
  };
  const st = { sha: null, hash: '' };
  const call = (u, init = {}) => fetch(u, { ...init, signal: AbortSignal.timeout(25000) });

  async function meta() {
    const r = await call(`${url}?ref=${encodeURIComponent(branch)}`, { headers: baseHeaders });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GitHub respondeu ${r.status} ao ler o backup (${await r.text().catch(() => '')})`.slice(0, 300));
    return r.json();
  }

  // Lê o backup. Devolve o objeto do banco, ou null se ainda não existe.
  async function restore() {
    if (!enabled) return null;
    const m = await meta();
    if (!m) return null;
    st.sha = m.sha;
    let buf;
    if (m.content && m.encoding === 'base64') buf = Buffer.from(String(m.content).replace(/\s/g, ''), 'base64');
    else {
      const r = await call(`${url}?ref=${encodeURIComponent(branch)}`, { headers: { ...baseHeaders, Accept: 'application/vnd.github.raw+json' } });
      if (!r.ok) throw new Error(`GitHub respondeu ${r.status} ao baixar o backup`);
      buf = Buffer.from(await r.arrayBuffer());
    }
    const json = zlib.gunzipSync(buf).toString('utf8');
    st.hash = crypto.createHash('sha1').update(json).digest('hex');
    return JSON.parse(json);
  }

  // Envia o banco. Devolve true se enviou, false se nada mudou desde o último envio.
  async function push(data) {
    if (!enabled) return false;
    const json = JSON.stringify(data);
    const hash = crypto.createHash('sha1').update(json).digest('hex');
    if (hash === st.hash) return false;
    const content = zlib.gzipSync(json).toString('base64');
    const put = (sha) => call(url, {
      method: 'PUT',
      headers: { ...baseHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `backup ${new Date().toISOString()}`, content, branch, ...(sha ? { sha } : {}) }),
    });
    let r = await put(st.sha);
    if (r.status === 409 || r.status === 422) { // sha antigo: pega o atual e tenta de novo
      const m = await meta();
      r = await put(m ? m.sha : undefined);
    }
    if (!r.ok) throw new Error(`GitHub respondeu ${r.status} ao salvar (${await r.text().catch(() => '')})`.slice(0, 300));
    const out = await r.json().catch(() => ({}));
    st.sha = out?.content?.sha || st.sha;
    st.hash = hash;
    return true;
  }

  // ---- agendamento: junta vários salvamentos em um só ----
  let getData = null, timer = null, dueAt = 0, busy = null, dirty = false, last = 0;
  const attach = (fn) => { getData = fn; };
  function schedule(urgent = false) {
    if (!enabled || !getData) return;
    dirty = true;
    const at = Math.max(Date.now(), last + (urgent ? urgentGap : minGap));
    if (timer && dueAt <= at) return;
    clearTimeout(timer);
    dueAt = at;
    timer = setTimeout(run, at - Date.now());
  }
  async function run() {
    timer = null;
    if (busy) return;
    dirty = false;
    busy = (async () => {
      try {
        if (await push(getData())) log.log('[GitHub] backup salvo.');
      } catch (e) {
        dirty = true;
        log.error('[GitHub] backup falhou:', e.message);
      } finally {
        last = Date.now();
        busy = null;
      }
    })();
    await busy;
    if (dirty) schedule();
  }
  // Usado ao desligar o servidor: salva já, sem esperar o intervalo.
  async function flush() {
    if (!enabled || !getData) return;
    clearTimeout(timer); timer = null;
    if (busy) await busy;
    try { if (await push(getData())) log.log('[GitHub] backup final salvo.'); }
    catch (e) { log.error('[GitHub] backup final falhou:', e.message); }
  }
  const stop = () => { clearTimeout(timer); timer = null; };

  return { enabled, repo, branch, filePath, restore, push, attach, schedule, flush, stop };
}
