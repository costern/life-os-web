const esc = s => String(s ?? '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
const fmt = n => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + ' $';
const ov = {};

async function api(path, opts) {
  const r = await fetch('/api' + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
  if (r.status === 401) { location.href = '/login.html'; throw new Error('Nicht angemeldet'); }
  const isJson = (r.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await r.json() : null;
  if (!r.ok) throw new Error((data && data.error) || ('Fehler ' + r.status));
  return data;
}

(function(){
  const btns = document.querySelectorAll('nav.side button[data-page]');
  function show(id){
    document.querySelectorAll('section.page').forEach(s => s.classList.toggle('active', s.id === 'page-'+id));
    btns.forEach(b => b.classList.toggle('active', b.dataset.page === id));
    try { localStorage.setItem('lifeos-page', id); } catch(e){}
  }
  btns.forEach(b => b.addEventListener('click', () => show(b.dataset.page)));
  let saved = null;
  try { saved = localStorage.getItem('lifeos-page'); } catch(e){}
  if (saved && document.getElementById('page-'+saved)) show(saved);

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await api('/logout', { method: 'POST' });
    location.href = '/login.html';
  });

  const now = new Date();
  const h = now.getHours();
  document.getElementById('greeting').innerHTML = (h<11?'Guten Morgen':h<18?'Guten Tag':'Guten Abend') + ', Colin<span>.</span>';
  document.getElementById('dateline').textContent = now.toLocaleDateString('de-DE',{weekday:'long', day:'2-digit', month:'long', year:'numeric'});
})();

function renderOverview(){
  const el = document.getElementById('ovStats');
  const parts = [];
  if (ov.todos !== undefined)
    parts.push('<div class="stat"><div class="v">'+ov.todos+'</div><div class="l">offene To-Dos</div></div>');
  if (ov.unreal !== undefined)
    parts.push('<div class="stat"><div class="v '+(ov.unreal>=0?'pnl-pos':'pnl-neg')+'">'+fmt(ov.unreal)+'</div><div class="l">offene Positionen</div></div>');
  if (ov.sumPnl !== undefined)
    parts.push('<div class="stat"><div class="v '+(ov.sumPnl>=0?'pnl-pos':'pnl-neg')+'">'+fmt(ov.sumPnl)+'</div><div class="l">Σ PnL realisiert</div></div>');
  el.innerHTML = parts.join('') || '<div class="empty">Keine Daten</div>';

  if (ov.sumPnl !== undefined && ov.unreal !== undefined){
    const total = ov.sumPnl + ov.unreal;
    const html = '<div class="stats">' +
      '<div class="stat"><div class="v '+(ov.sumPnl>=0?'pnl-pos':'pnl-neg')+'">'+fmt(ov.sumPnl)+'</div><div class="l">realisiert</div></div>' +
      '<div class="stat"><div class="v '+(ov.unreal>=0?'pnl-pos':'pnl-neg')+'">'+fmt(ov.unreal)+'</div><div class="l">offene Positionen</div></div>' +
      '<div class="stat"><div class="v '+(total>=0?'pnl-pos':'pnl-neg')+'" style="font-size:22px">'+fmt(total)+'</div><div class="l">zusammen</div></div>' +
    '</div>';
    ['tradingTotalCard','tradingTotalCard2'].forEach(id => { const c = document.getElementById(id); if (c) c.style.display=''; });
    const t1 = document.getElementById('tradingTotal'); if (t1) t1.innerHTML = html;
    const t2 = document.getElementById('tradingTotal2'); if (t2) t2.innerHTML = html;
  }
}

async function ladeMacro(){
  const targets = [document.getElementById('macro'), document.getElementById('macroFull')];
  try {
    const m = await api('/macro');
    if (m.updated_at == null && m.ffr == null){
      targets.forEach(el => el && (el.innerHTML = '<div class="empty">Noch keine Marktlage eingetragen – frag mich einfach danach im Chat.</div>'));
      return;
    }
    const real = m.real_rate != null ? Number(m.real_rate) : null;
    const html =
      '<div class="macro-grid">' +
        stat('Leitzins (FFR)', m.ffr, '%', m.ffr_date) +
        stat('10J Treasury', m.ty, '%', m.ty_date) +
        stat('Inflation (CPI YoY)', m.inflation, '%', m.cpi_date) +
        stat('Realzins', real, '%', null) +
      '</div>' +
      (m.note ? '<div class="macro-take">'+esc(m.note)+'</div>' : '') +
      '<div class="muted" style="margin-top:8px">Stand: '+(m.updated_at ? new Date(m.updated_at).toLocaleString('de-DE') : '–')+'</div>';
    targets.forEach(el => el && (el.innerHTML = html));
  } catch(e){
    targets.forEach(el => el && (el.innerHTML = '<div class="err">Marktlage nicht ladbar: '+esc(e.message)+'</div>'));
  }
}
function stat(label, val, unit, date){
  return '<div class="macro-stat"><div class="v">'+(val!=null?Number(val).toFixed(2)+unit:'–')+'</div>' +
    '<div class="l">'+label+'</div>' + (date?'<div class="l">'+esc(date)+'</div>':'') + '</div>';
}

async function ladeNews(){
  const el = document.getElementById('news');
  if (!el) return;
  try {
    const rows = await api('/news');
    if (!rows.length){ el.innerHTML = '<div class="empty">Noch keine News eingetragen – frag mich einfach danach im Chat.</div>'; return; }
    el.innerHTML = rows.map(n => (
      '<div class="ni"><div class="head" style="display:flex;gap:9px;align-items:flex-start">' +
      '<span class="dot-w '+(n.importance>0.6?'hoch':n.importance>0.3?'mittel':'niedrig')+'"></span>' +
      '<div class="body"><div class="ni-t">'+esc(n.title)+'</div>' +
      '<div class="ni-k">'+esc(n.summary||'')+'</div>' +
      '<div class="muted" style="margin-top:5px">'+esc(n.source||'')+(n.url?' · <a href="'+esc(n.url)+'" target="_blank">Quelle</a>':'')+'</div>' +
      '</div></div></div>'
    )).join('');
  } catch(e){ el.innerHTML = '<div class="err">News nicht ladbar: '+esc(e.message)+'</div>'; }
}

(function(){
  const view = document.getElementById('readingView');
  const editBox = document.getElementById('readingEdit');
  const ta = document.getElementById('readingTa');
  let current = '';

  function renderView(md){
    view.innerHTML = md ? '<div style="white-space:pre-wrap;line-height:1.6;font-size:14px">'+esc(md)+'</div>'
      : '<div class="empty">Noch nichts eingetragen – auf "Bearbeiten" klicken.</div>';
  }

  async function laden(){
    try { const d = await api('/reading'); current = d.content_md || ''; renderView(current); }
    catch(e){ view.innerHTML = '<div class="err">Nicht ladbar: '+esc(e.message)+'</div>'; }
  }
  laden();

  document.getElementById('editReadingBtn').addEventListener('click', () => {
    ta.value = current; editBox.style.display = 'block'; ta.focus();
  });
  document.getElementById('cancelReadingBtn').addEventListener('click', () => { editBox.style.display = 'none'; });
  document.getElementById('saveReadingBtn').addEventListener('click', async () => {
    try { const d = await api('/reading', { method:'PUT', body: JSON.stringify({ content: ta.value }) });
      current = d.content_md; renderView(current); editBox.style.display = 'none'; }
    catch(e){ alert('Konnte nicht gespeichert werden: ' + e.message); }
  });
})();

(function(){
  const el = document.getElementById('todos');
  let rows = [];

  function zeile(r){
    return '<div class="row" data-id="'+r.id+'">' +
      '<span class="tcb'+(r.done?' done':'')+'" role="button">'+(r.done?'✓':'○')+'</span>' +
      '<span class="t">'+esc(r.text)+'</span>' +
      (r.prio ? '<span class="badge'+(r.prio==='Hoch'?' red':r.prio==='Mittel'?' amber':'')+'">'+esc(r.prio)+'</span>' : '') +
      (r.thema ? '<span class="badge">'+esc(r.thema)+'</span>' : '') +
      (r.due ? '<span class="muted">'+new Date(r.due).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})+'</span>' : '') +
    '</div>';
  }

  async function laden(){
    try {
      rows = await api('/todos');
      ov.todos = rows.filter(r => !r.done).length; renderOverview();
      el.innerHTML = rows.length ? rows.map(zeile).join('') : '<div class="empty">Keine To-Dos</div>';
    } catch(e){ el.innerHTML = '<div class="err">To-Dos nicht ladbar: '+esc(e.message)+'</div>'; }
  }
  laden();

  el.addEventListener('click', async ev => {
    const cb = ev.target.closest('.tcb'); if (!cb) return;
    const id = +cb.closest('.row').dataset.id;
    const r = rows.find(x => x.id === id); if (!r) return;
    cb.textContent = '…';
    try { await api('/todos/'+id, { method:'PATCH', body: JSON.stringify({ done: !r.done }) }); await laden(); }
    catch(e){ alert('Fehler: ' + e.message); await laden(); }
  });

  document.getElementById('todoAdd').addEventListener('submit', async ev => {
    ev.preventDefault();
    const text = document.getElementById('ntText').value.trim();
    if (!text) return;
    const due = document.getElementById('ntDue').value;
    const thema = document.getElementById('ntThema').value;
    try {
      await api('/todos', { method:'POST', body: JSON.stringify({ text, due: due||null, thema: thema||null }) });
      document.getElementById('ntText').value = ''; document.getElementById('ntDue').value = '';
      document.getElementById('ntThema').value = ''; await laden();
    } catch(e){ alert('Konnte nicht angelegt werden: ' + e.message); }
  });
})();

let openTrades = [];

async function ladeHistorie(){
  const el = document.getElementById('trades');
  try {
    const rows = await api('/trades');
    const closed = rows.filter(r => r.exit != null);
    const withPnl = closed.filter(r => r.pnl != null);
    const sum = withPnl.reduce((a,r) => a + Number(r.pnl), 0);
    const wins = withPnl.filter(r => Number(r.pnl) > 0).length;
    ov.sumPnl = sum; renderOverview();
    document.getElementById('tstats').innerHTML =
      '<div class="stat"><div class="v">'+rows.filter(r=>r.exit==null).length+'</div><div class="l">offen</div></div>' +
      '<div class="stat"><div class="v">'+(withPnl.length?Math.round(wins/withPnl.length*100)+'%':'–')+'</div><div class="l">Winrate</div></div>' +
      '<div class="stat"><div class="v '+(sum>=0?'pnl-pos':'pnl-neg')+'">'+(withPnl.length?fmt(sum):'–')+'</div><div class="l">Σ PnL</div></div>';
    el.innerHTML = rows.slice(0,15).map(r => (
      '<div class="row"><span class="t">'+esc(r.name||r.asset)+'</span>' +
      '<span class="badge">'+esc(r.asset)+' '+esc(r.side)+'</span>' +
      (r.exit==null ? '<span class="badge amber">LIVE</span>'
        : (r.pnl!=null ? '<span class="'+(r.pnl>=0?'pnl-pos':'pnl-neg')+'">'+fmt(r.pnl)+'</span>' : '<span class="muted">PnL fehlt</span>')) +
      '</div>'
    )).join('') || '<div class="empty">Noch keine Trades</div>';
  } catch(e){ el.innerHTML = '<div class="err">Historie nicht ladbar: '+esc(e.message)+'</div>'; }
}

function rundPreis(v){
  if (!isFinite(v)) return '';
  const a = Math.abs(v);
  return +v.toFixed(a < 1 ? 5 : a < 100 ? 4 : 2);
}

async function ladePreis(ticker){
  try { return await api('/prices/'+encodeURIComponent(ticker)); }
  catch(e){ return null; }
}

async function renderLivePos(){
  const el = document.getElementById('livepos');
  try {
    openTrades = await api('/trades/open');
    if (!openTrades.length){ el.innerHTML = '<div class="empty">Keine offenen Positionen</div>'; ov.unreal = 0; renderOverview(); return; }

    let total = 0, allPriced = true;
    const parts = [];
    for (const [idx, o] of openTrades.entries()){
      const size = (o.size1||0) + (o.size2||0);
      const avg = size ? ((o.entry1||0)*(o.size1||0) + (o.entry2||0)*(o.size2||0)) / size : 0;
      const dir = o.side === 'Short' ? -1 : 1;
      const p = await ladePreis(o.ticker || o.asset);
      o._avg = avg; o._size = size; o._dir = dir;
      let pnlHtml = '<span class="muted">kein Kurs</span>';
      let last = null;
      if (p && isFinite(p.last)){
        last = p.last;
        const pnl = dir*(last-avg)*size; total += pnl;
        const pct = avg ? dir*(last-avg)/avg*100 : 0;
        pnlHtml = '<span class="'+(pnl>=0?'pnl-pos':'pnl-neg')+'">'+fmt(pnl)+' ('+(pct>=0?'+':'')+pct.toFixed(1)+'%)</span>';
      } else allPriced = false;
      const beSchon = o.sl != null && avg > 0 && Math.abs(o.sl - avg) < avg*0.0008;
      const slTxt = o.sl != null ? (beSchon ? o.sl + ' <span class="badge green">BE</span>' : String(o.sl)) : '–';
      parts.push(
        '<div class="row"><span class="t">'+esc(o.asset)+' '+esc(o.side)+' <span class="muted">@ '+
        avg.toLocaleString('de-DE',{maximumFractionDigits:4})+(last!=null?' → '+last.toLocaleString('de-DE',{maximumFractionDigits:4}):'')+
        '</span></span>'+pnlHtml+'</div>' +
        '<div class="muted" style="padding:0 0 6px 0">'+esc(o.name||'')+' · SL '+slTxt+' · TP '+(o.tp??'–')+
        ' · <span class="lp-toggle" role="button" data-idx="'+idx+'">verwalten</span></div>' +
        '<div class="lp-panel" data-idx="'+idx+'">' +
          '<div class="lp-line">' +
            '<label>SL</label><input type="number" step="any" class="lp-sl" value="'+(o.sl??'')+'">' +
            '<label>TP</label><input type="number" step="any" class="lp-tp" value="'+(o.tp??'')+'">' +
            '<button type="button" class="lp-save">Speichern</button>' +
            (beSchon ? '' : '<button type="button" class="lp-be ghost">SL auf Break Even</button>') +
          '</div>' +
          '<div class="lp-line">' +
            '<label>Exit</label><input type="number" step="any" class="lp-exit" value="'+(last!=null?rundPreis(last):'')+'">' +
            '<button type="button" class="lp-close danger">Position schließen</button>' +
            '<span class="lp-vor"></span>' +
          '</div>' +
          '<div class="lp-msg"></div>' +
        '</div>'
      );
    }
    ov.unreal = total; renderOverview();
    el.innerHTML =
      '<div class="stats"><div class="stat"><div class="v '+(total>=0?'pnl-pos':'pnl-neg')+'">'+fmt(total)+'</div><div class="l">unrealisierter PnL'+(allPriced?'':' (teilw.)')+'</div></div>' +
      '<div class="stat"><div class="v">'+openTrades.length+'</div><div class="l">offene Positionen</div></div></div>' +
      parts.join('') +
      '<div class="muted" style="margin-top:6px">Live von Crypto.com · ohne Fees/Funding</div>';
  } catch(e){ el.innerHTML = '<div class="err">Live-Daten nicht ladbar: '+esc(e.message)+'</div>'; }
}

document.addEventListener('input', ev => {
  const inp = ev.target.closest('.lp-exit'); if (!inp) return;
  const panel = inp.closest('.lp-panel');
  const o = openTrades[+panel.dataset.idx]; if (!o) return;
  const vor = panel.querySelector('.lp-vor');
  const v = parseFloat(inp.value);
  if (isFinite(v) && o._size){ vor.innerHTML = 'ergibt <span class="'+(o._dir*(v-o._avg)*o._size>=0?'pnl-pos':'pnl-neg')+'">'+fmt(o._dir*(v-o._avg)*o._size)+'</span>'; }
  else vor.textContent = '';
});

document.addEventListener('click', async ev => {
  const tgl = ev.target.closest('.lp-toggle');
  if (tgl){ document.querySelector('.lp-panel[data-idx="'+tgl.dataset.idx+'"]').classList.toggle('on'); return; }

  const panel = ev.target.closest('.lp-panel'); if (!panel) return;
  const o = openTrades[+panel.dataset.idx]; if (!o) return;
  const msg = panel.querySelector('.lp-msg');
  const zeige = (t, ok) => { msg.textContent = t; msg.className = 'lp-msg ' + (ok?'ok':'bad'); };

  if (ev.target.closest('.lp-be')){ panel.querySelector('.lp-sl').value = rundPreis(o._avg); zeige('SL auf Einstand gesetzt – noch Speichern klicken.', true); return; }

  const save = ev.target.closest('.lp-save');
  if (save){
    const sl = parseFloat(panel.querySelector('.lp-sl').value);
    const tp = parseFloat(panel.querySelector('.lp-tp').value);
    save.disabled = true; save.textContent = 'speichert…';
    try {
      await api('/trades/'+o.id, { method:'PATCH', body: JSON.stringify({ sl: isFinite(sl)?sl:null, tp: isFinite(tp)?tp:null }) });
      zeige('Gespeichert ✓', true);
      setTimeout(renderLivePos, 800);
    } catch(e){ zeige('Fehler: '+e.message, false); save.disabled = false; save.textContent = 'Speichern'; }
    return;
  }

  const close = ev.target.closest('.lp-close');
  if (close){
    const exit = parseFloat(panel.querySelector('.lp-exit').value);
    if (!isFinite(exit) || exit <= 0){ zeige('Bitte gültigen Exit-Kurs eintragen.', false); return; }
    if (close.dataset.confirm !== '1'){
      close.dataset.confirm = '1'; close.textContent = 'Wirklich schließen?';
      setTimeout(() => { if (close.dataset.confirm==='1'){ delete close.dataset.confirm; close.textContent='Position schließen'; } }, 5000);
      return;
    }
    delete close.dataset.confirm;
    close.disabled = true; close.textContent = 'schließt…';
    try {
      const r = await api('/trades/'+o.id+'/close', { method:'POST', body: JSON.stringify({ exit }) });
      zeige('Geschlossen mit ' + fmt(r.pnl) + ' ✓', true);
      setTimeout(() => { renderLivePos(); ladeHistorie(); }, 1000);
    } catch(e){ zeige('Fehler: '+e.message, false); close.disabled = false; close.textContent = 'Position schließen'; }
  }
});

document.getElementById('refreshPrices').addEventListener('click', () => vielleichtAuffrischen(true));

(function(){
  const el = document.getElementById('newTradeForm');
  el.innerHTML =
    '<form class="ntform" id="ntForm">' +
      '<input type="text" id="ntAsset" placeholder="Asset (z.B. ETH)" required>' +
      '<select id="ntSide"><option>Long</option><option>Short</option></select>' +
      '<input type="number" step="any" id="ntEntry" placeholder="Entry" required>' +
      '<input type="number" step="any" id="ntSize" placeholder="Größe" required>' +
      '<input type="number" step="any" id="ntSl" placeholder="SL">' +
      '<input type="number" step="any" id="ntTp" placeholder="TP">' +
      '<button type="submit" class="btn">Anlegen</button>' +
    '</form><div class="err" id="ntErr" style="display:none"></div>';

  document.getElementById('ntForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const errEl = document.getElementById('ntErr');
    errEl.style.display = 'none';
    const asset = document.getElementById('ntAsset').value.trim();
    try {
      await api('/trades', { method:'POST', body: JSON.stringify({
        asset, ticker: asset.toUpperCase(), side: document.getElementById('ntSide').value,
        entry1: parseFloat(document.getElementById('ntEntry').value),
        size1: parseFloat(document.getElementById('ntSize').value),
        sl: parseFloat(document.getElementById('ntSl').value) || null,
        tp: parseFloat(document.getElementById('ntTp').value) || null
      })});
      document.getElementById('ntForm').reset();
      renderLivePos(); ladeHistorie();
    } catch(e){ errEl.textContent = e.message; errEl.style.display = 'block'; }
  });
})();

/* Auffrischen nur, wenn der Tab wirklich sichtbar ist und die Trading-Seite offen ist.
   Sonst würde die Datenbank bei einem dauerhaft offenen Tab nie schlafen gehen und
   unnötig Rechenstunden der Gratis-Stufe verbrauchen. */
const AKTUALISIERUNG_MS = 60000;
let letzteAktualisierung = 0;

function tradingSichtbar(){
  const p = document.getElementById('page-trading');
  return document.visibilityState === 'visible' && p && p.classList.contains('active');
}

async function vielleichtAuffrischen(erzwingen){
  if (!erzwingen && !tradingSichtbar()) return;
  if (!erzwingen && Date.now() - letzteAktualisierung < AKTUALISIERUNG_MS - 1000) return;
  letzteAktualisierung = Date.now();
  await renderLivePos();
}

document.addEventListener('visibilitychange', () => { if (tradingSichtbar()) vielleichtAuffrischen(); });
document.querySelectorAll('nav.side button[data-page]').forEach(b =>
  b.addEventListener('click', () => { if (b.dataset.page === 'trading') vielleichtAuffrischen(); }));

ladeMacro(); ladeNews(); ladeHistorie();
renderLivePos().then(() => { letzteAktualisierung = Date.now(); });
setInterval(() => vielleichtAuffrischen(), AKTUALISIERUNG_MS);
