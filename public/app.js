const esc = s => String(s ?? '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
const fmt = n => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + ' $';
const fmtAmount = n => {
  const x = Number(n);
  if (!isFinite(x)) return String(n);
  if (x === 0) return '0';
  const abs = Math.abs(x);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 4 : abs >= 0.01 ? 6 : 8;
  let s = x.toFixed(digits).replace(/0+$/,'').replace(/\.$/,'');
  const parts = s.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.join(',');
};
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

/* ---------- Quote of the Day ---------- */
(function(){
  const QUOTES = [
    ["The market is a device for transferring money from the impatient to the patient.","Warren Buffett"],
    ["Discipline equals freedom.","Jocko Willink"],
    ["It's not whether you're right or wrong that's important, but how much money you make when you're right and how much you lose when you're wrong.","George Soros"],
    ["We are what we repeatedly do. Excellence, then, is not an act, but a habit.","Will Durant"],
    ["You do not rise to the level of your goals. You fall to the level of your systems.","James Clear"],
    ["Amateurs think about how much money they can make. Professionals think about how much money they could lose.","Jack Schwager"],
    ["Waste no more time arguing what a good man should be. Be one.","Marcus Aurelius"],
    ["Losers average losers.","Paul Tudor Jones"],
    ["The obstacle is the way.","Marcus Aurelius"],
    ["Motivation gets you going, but discipline keeps you growing.","John C. Maxwell"],
    ["Risk comes from not knowing what you're doing.","Warren Buffett"],
    ["It is not that we have a short time to live, but that we waste a lot of it.","Seneca"],
    ["The goal of a successful trader is to make the best trades. Money is secondary.","Alexander Elder"],
    ["Hard choices, easy life. Easy choices, hard life.","Jerzy Gregorek"],
    ["Every battle is won before it is ever fought.","Sun Tzu"],
    ["The person who says it cannot be done should not interrupt the person doing it.","Chinese proverb"],
    ["Do not pray for an easy life, pray for the strength to endure a difficult one.","Bruce Lee"],
    ["Patience is not the ability to wait, but the ability to keep a good attitude while waiting.","Joyce Meyer"],
    ["The trend is your friend until the end when it bends.","Ed Seykota"],
    ["Success is the sum of small efforts repeated day in and day out.","Robert Collier"],
    ["Know what you own, and know why you own it.","Peter Lynch"],
    ["A goal without a plan is just a wish.","Antoine de Saint-Exupéry"],
    ["The four most dangerous words in investing are: this time it's different.","Sir John Templeton"],
    ["Fall seven times, stand up eight.","Japanese proverb"],
    ["Don't find fault, find a remedy.","Henry Ford"],
    ["The market can remain irrational longer than you can remain solvent.","attributed to John Maynard Keynes"],
    ["What stands in the way becomes the way.","Marcus Aurelius"],
    ["Be fearful when others are greedy and greedy when others are fearful.","Warren Buffett"],
    ["Comparison is the thief of joy.","Theodore Roosevelt"],
    ["The first principle is that you must not fool yourself, and you are the easiest person to fool.","Richard Feynman"],
    ["Cut your losses short and let your winners run.","Trading proverb"],
    ["Energy and persistence conquer all things.","Benjamin Franklin"],
    ["It's not the daily increase but daily decrease. Hack away at the unessential.","Bruce Lee"],
    ["The two most powerful warriors are patience and time.","Leo Tolstoy"],
    ["An investment in knowledge pays the best interest.","Benjamin Franklin"],
    ["Wide diversification is only required when investors do not understand what they are doing.","Warren Buffett"],
    ["You miss 100% of the shots you don't take.","Wayne Gretzky"],
    ["Simplicity is the ultimate sophistication.","Leonardo da Vinci"],
    ["What we fear doing most is usually what we most need to do.","Tim Ferriss"],
    ["The best time to plant a tree was 20 years ago. The second best time is now.","Chinese proverb"],
    ["Slow is smooth, smooth is fast.","Military adage"],
    ["Time in the market beats timing the market.","Investing proverb"],
    ["Rule number one: never lose money. Rule number two: never forget rule number one.","Warren Buffett"],
    ["Nothing in the world is worth having or worth doing unless it means effort.","Theodore Roosevelt"],
    ["The successful warrior is the average man with laser-like focus.","Bruce Lee"],
    ["Adversity introduces a man to himself.","Anonymous"],
    ["The way to get started is to quit talking and begin doing.","Walt Disney"],
    ["He who fears he shall suffer, already suffers what he fears.","Michel de Montaigne"],
    ["Compound interest is the eighth wonder of the world.","attributed to Albert Einstein"],
    ["The best swordsman does not fear the second best.","Nassim Taleb"],
    ["In trading, the impossible happens about twice a year.","Henri M. Simoes"],
    ["If you want to be a great trader, you have to be willing to be wrong.","Trading proverb"]
  ];
  const now = new Date();
  const doy = Math.floor((now - new Date(now.getFullYear(),0,0)) / 864e5);
  const q = QUOTES[doy % QUOTES.length];
  const qt = document.getElementById('qText'), qa = document.getElementById('qAuthor');
  if (qt) qt.textContent = '„' + q[0] + '"';
  if (qa) qa.textContent = '— ' + q[1];
})();

(function(){
  const card = document.getElementById('macroCard');
  const toggle = document.getElementById('macroToggle');
  if (!card || !toggle) return;
  let eingeklappt = false;
  try { eingeklappt = localStorage.getItem('macro-collapsed') === '1'; } catch(e){}
  if (eingeklappt) card.classList.add('collapsed');
  toggle.addEventListener('click', () => {
    card.classList.toggle('collapsed');
    try { localStorage.setItem('macro-collapsed', card.classList.contains('collapsed') ? '1' : '0'); } catch(e){}
  });
})();

function renderOverview(){
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
    const prevReal = (m.prev_ffr != null && m.prev_inflation != null) ? Number(m.prev_ffr) - Number(m.prev_inflation) : null;
    const html =
      '<div class="macro-grid">' +
        stat('Leitzins (FFR)', m.ffr, m.prev_ffr, '%', m.ffr_date) +
        stat('10J Treasury', m.ty, m.prev_ty, '%', m.ty_date) +
        stat('Inflation (CPI YoY)', m.inflation, m.prev_inflation, '%', m.cpi_date) +
        stat('Realzins', real, prevReal, '%', null) +
      '</div>' +
      (m.note ? '<div class="macro-take">'+esc(m.note)+'</div>' : '') +
      '<div class="muted" style="margin-top:8px">Stand: '+(m.updated_at ? new Date(m.updated_at).toLocaleString('de-DE') : '–')+'</div>';
    targets.forEach(el => el && (el.innerHTML = html));
  } catch(e){
    targets.forEach(el => el && (el.innerHTML = '<div class="err">Marktlage nicht ladbar: '+esc(e.message)+'</div>'));
  }
}
function stat(label, val, prev, unit, date){
  let delta = '';
  if (val != null && prev != null){
    const d = Number(val) - Number(prev);
    if (Math.abs(d) >= 0.005){
      const auf = d > 0;
      delta = ' <span class="macro-delta '+(auf?'pnl-pos':'pnl-neg')+'">'+(auf?'▲':'▼')+' '+(auf?'+':'')+d.toFixed(2)+unit+'</span>';
    }
  }
  return '<div class="macro-stat"><div class="v">'+(val!=null?Number(val).toFixed(2)+unit:'–')+delta+'</div>' +
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

async function ladeKalender(){
  const el = document.getElementById('kalender');
  if (!el) return;
  try {
    const d = await api('/calendar');
    if (!d.configured){
      el.innerHTML = '<div class="empty">Noch nicht verbunden – sag mir, dann richte ich deinen Google-Kalender ein.</div>';
      return;
    }
    if (d.error){ el.innerHTML = '<div class="err">Kalender nicht erreichbar: '+esc(d.error)+'</div>'; return; }
    const events = d.events || [];
    if (!events.length){ el.innerHTML = '<div class="empty">Keine Termine in den nächsten 14 Tagen 🎉</div>'; return; }
    const heute = new Date();
    const days = ['So','Mo','Di','Mi','Do','Fr','Sa'];
    el.innerHTML = events.map(ev => {
      const dt = new Date(ev.start);
      const when = days[dt.getDay()]+' '+dt.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}) +
        (ev.allDay ? '' : ', '+dt.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}));
      return '<div class="row'+(dt.toDateString()===heute.toDateString()?' today-mark':'')+'"><span class="t">'+esc(ev.title)+'</span><span class="muted">'+when+'</span></div>';
    }).join('');
  } catch(e){ el.innerHTML = '<div class="err">Kalender nicht ladbar: '+esc(e.message)+'</div>'; }
}

/* ---------- Übersicht: kurzer Überblick der offenen (gehebelten) Trades ---------- */
async function ladeOvTrades(){
  const el = document.getElementById('ovTrades');
  if (!el) return;
  try {
    const trades = await api('/trades/open');
    if (!trades.length){ el.innerHTML = '<div class="empty">Keine offenen Positionen</div>'; return; }
    const zeilen = await Promise.all(trades.map(async o => {
      const size = (o.size1||0) + (o.size2||0);
      const avg = size ? ((o.entry1||0)*(o.size1||0) + (o.entry2||0)*(o.size2||0)) / size : 0;
      const dir = o.side === 'Short' ? -1 : 1;
      const p = await ladePreis(o.ticker || o.asset);
      const rund3 = v => { const a = Math.abs(v); return Number(v).toFixed(a >= 1000 ? 1 : a >= 1 ? 3 : 4); };
      let pnlHtml = '<span class="muted">kein Kurs</span>';
      let kursZeile = 'Entry '+(avg?rund3(avg):'–');
      if (p && isFinite(p.last)){
        kursZeile += ' → aktuell '+rund3(p.last);
        if (avg && size){
          const pnl = dir*(p.last-avg)*size;
          pnlHtml = '<span class="'+(pnl>=0?'pnl-pos':'pnl-neg')+'">'+fmt(pnl)+'</span>';
        }
      }
      return '<div class="row"><span class="t">'+esc(o.asset)+' <span class="muted">'+esc(o.side)+'</span></span>'+pnlHtml+'</div>' +
        '<div class="muted" style="padding:0 0 6px 0">'+kursZeile+'</div>';
    }));
    el.innerHTML = zeilen.join('');
  } catch(e){ el.innerHTML = '<div class="err">Trades nicht ladbar: '+esc(e.message)+'</div>'; }
}

/* ---------- Kalender: Monatsansicht auf der To-Dos-Seite ---------- */
(function(){
  const grid = document.getElementById('calGrid');
  const label = document.getElementById('calMonthLabel');
  if (!grid || !label) return;
  let aktMonat = new Date(); aktMonat.setDate(1); aktMonat.setHours(0,0,0,0);

  function montag(d){
    const t = new Date(d);
    const tag = (t.getDay() + 6) % 7; // 0 = Montag
    t.setDate(t.getDate() - tag);
    t.setHours(0,0,0,0);
    return t;
  }
  function evDatum(ev){
    if (ev.allDay){ const [y,m,d] = ev.start.split('-').map(Number); return new Date(y, m-1, d); }
    return new Date(ev.start);
  }

  async function laden(){
    grid.innerHTML = '<div class="empty">Lade…</div>';
    const monatsStart = new Date(aktMonat.getFullYear(), aktMonat.getMonth(), 1);
    const monatsEnde = new Date(aktMonat.getFullYear(), aktMonat.getMonth()+1, 0);
    const gridStart = montag(monatsStart);
    const gridEnde = new Date(montag(monatsEnde)); gridEnde.setDate(gridEnde.getDate()+6);
    label.textContent = aktMonat.toLocaleDateString('de-DE',{month:'long', year:'numeric'});

    let events = [];
    try {
      const q = '?start='+encodeURIComponent(gridStart.toISOString())+'&end='+encodeURIComponent(new Date(gridEnde.getTime()+864e5).toISOString());
      const d = await api('/calendar'+q);
      if (!d.configured){ grid.innerHTML = '<div class="empty">Kalender noch nicht verbunden – sag mir Bescheid, dann richte ich das ein.</div>'; return; }
      if (d.error){ grid.innerHTML = '<div class="err">Kalender nicht erreichbar: '+esc(d.error)+'</div>'; return; }
      events = d.events || [];
    } catch(e){ grid.innerHTML = '<div class="err">Kalender nicht ladbar: '+esc(e.message)+'</div>'; return; }

    const heute = new Date(); heute.setHours(0,0,0,0);
    const tage = [];
    for (let d = new Date(gridStart); d <= gridEnde; d.setDate(d.getDate()+1)) tage.push(new Date(d));

    grid.innerHTML = tage.map(tag => {
      const inMonat = tag.getMonth() === aktMonat.getMonth();
      const istHeute = tag.toDateString() === heute.toDateString();
      const istWochenende = tag.getDay() === 0 || tag.getDay() === 6;
      const tagEvents = events.filter(ev => evDatum(ev).toDateString() === tag.toDateString());
      const evHtml = tagEvents.slice(0,3).map(ev => '<div class="cal-ev" title="'+esc(ev.title)+'">'+esc(ev.title)+'</div>').join('') +
        (tagEvents.length > 3 ? '<div class="muted">+'+(tagEvents.length-3)+' mehr</div>' : '');
      return '<div class="cal-day'+(inMonat?'':' other')+(istHeute?' today':'')+(istWochenende?' weekend':'')+'"><div class="dnum">'+tag.getDate()+'</div>'+evHtml+'</div>';
    }).join('');
  }

  document.getElementById('calPrev').addEventListener('click', () => { aktMonat.setMonth(aktMonat.getMonth()-1); laden(); });
  document.getElementById('calNext').addEventListener('click', () => { aktMonat.setMonth(aktMonat.getMonth()+1); laden(); });

  window.ladeKalenderMonat = laden;
  laden();
})();

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
  window.ladeReading = laden;
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
  const elTodos = document.getElementById('todos');
  const elBeob = document.getElementById('beob');
  const elOvTodos = document.getElementById('ovTodos');
  const elOvBeob = document.getElementById('ovBeobachten');
  const THEMEN_LISTE = ['Trading','Beobachten','Dashboard','Sport','Arbeit','Privat','Sonstiges'];
  let rows = [];
  let ansicht = 'offen';

  function panel(r){
    const themaOpts = '<option value="">Thema…</option>' + THEMEN_LISTE.map(th =>
      '<option'+(r.thema===th?' selected':'')+'>'+th+'</option>').join('');
    const prioOpts = '<option value="">Priorität…</option>' + ['Hoch','Mittel','Niedrig'].map(p =>
      '<option'+(r.prio===p?' selected':'')+'>'+p+'</option>').join('');
    return '<div class="todo-panel" data-id="'+r.id+'">' +
      '<div class="tp-line"><input type="text" class="te-text" maxlength="200" value="'+esc(r.text)+'" placeholder="Aufgabe"></div>' +
      '<div class="tp-line">' +
        '<input type="date" class="te-due" value="'+(r.due ? String(r.due).slice(0,10) : '')+'">' +
        '<select class="te-thema">'+themaOpts+'</select>' +
        '<select class="te-prio">'+prioOpts+'</select>' +
      '</div>' +
      '<div class="tp-line">' +
        '<button type="button" class="te-save">Speichern</button>' +
        '<button type="button" class="te-cancel ghost">Abbrechen</button>' +
        '<span class="te-msg"></span>' +
      '</div>' +
    '</div>';
  }

  function zeile(r){
    return '<div class="row" data-id="'+r.id+'">' +
      '<span class="tcb'+(r.done?' done':'')+'" role="button">'+(r.done?'✓':'○')+'</span>' +
      '<span class="t">'+esc(r.text)+'</span>' +
      (r.prio ? '<span class="badge'+(r.prio==='Hoch'?' red':r.prio==='Mittel'?' amber':'')+'">'+esc(r.prio)+'</span>' : '') +
      (r.thema ? '<span class="badge">'+esc(r.thema)+'</span>' : '') +
      (r.due ? '<span class="muted">'+new Date(r.due).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})+'</span>' : '') +
      '<span class="row-actions">' +
        '<span class="icon-btn todo-edit-toggle" role="button" title="Bearbeiten">✎</span>' +
        '<span class="icon-btn del todo-del" role="button" title="Löschen">🗑</span>' +
      '</span>' +
    '</div>' + panel(r);
  }

  const PRIO_RANK = { Hoch:0, Mittel:1, Niedrig:2 };
  function sortiert(list){
    return list.slice().sort((a,b) => {
      if (!!a.due !== !!b.due) return a.due ? -1 : 1;
      if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
      return (PRIO_RANK[a.prio] ?? 3) - (PRIO_RANK[b.prio] ?? 3);
    });
  }

  function zeichne(){
    const gefiltert = rows.filter(r => ansicht === 'erledigt' ? r.done : !r.done);
    const normal = sortiert(gefiltert.filter(r => r.thema !== 'Beobachten'));
    const beob = sortiert(gefiltert.filter(r => r.thema === 'Beobachten'));

    ov.todos = rows.filter(r => !r.done).length; renderOverview();

    if (elTodos) elTodos.innerHTML = normal.length ? normal.map(zeile).join('')
      : '<div class="empty">'+(ansicht==='erledigt' ? 'Noch nichts erledigt' : 'Keine offenen To-Dos')+'</div>';
    if (elBeob) elBeob.innerHTML = beob.length ? beob.map(zeile).join('')
      : '<div class="empty">'+(ansicht==='erledigt' ? 'Noch nichts erledigt' : 'Nichts zu beobachten')+'</div>';

    const normalOffen = normal.filter(r => !r.done);
    const beobOffen = beob.filter(r => !r.done);
    if (elOvTodos) elOvTodos.innerHTML = normalOffen.length ? normalOffen.slice(0,6).map(zeile).join('') : '<div class="empty">Alles erledigt ✨</div>';
    if (elOvBeob) elOvBeob.innerHTML = beobOffen.length ? beobOffen.slice(0,6).map(zeile).join('') : '<div class="empty">Nichts zu beobachten</div>';
  }

  async function laden(){
    try { rows = await api('/todos'); zeichne(); }
    catch(e){
      const msg = '<div class="err">To-Dos nicht ladbar: '+esc(e.message)+'</div>';
      [elTodos, elBeob, elOvTodos, elOvBeob].forEach(el => { if (el) el.innerHTML = msg; });
    }
  }
  window.ladeTodos = laden;
  laden();

  document.querySelectorAll('.tabbar .tab').forEach(btn => {
    btn.addEventListener('click', () => {
      ansicht = btn.dataset.ansicht;
      document.querySelectorAll('.tabbar .tab').forEach(b => b.classList.toggle('active', b === btn));
      zeichne();
    });
  });

  document.addEventListener('click', async ev => {
    if (!ev.target.closest('#todos, #beob, #ovTodos, #ovBeobachten')) return;

    const cb = ev.target.closest('.tcb');
    if (cb){
      const id = +cb.closest('.row').dataset.id;
      const r = rows.find(x => x.id === id); if (!r) return;
      cb.textContent = '…';
      try { await api('/todos/'+id, { method:'PATCH', body: JSON.stringify({ done: !r.done }) }); await laden(); }
      catch(e){ alert('Fehler: ' + e.message); await laden(); }
      return;
    }

    const editTgl = ev.target.closest('.todo-edit-toggle');
    if (editTgl){
      const row = editTgl.closest('.row');
      const p = row && row.nextElementSibling;
      if (p && p.classList.contains('todo-panel')) p.classList.toggle('on');
      return;
    }

    const del = ev.target.closest('.todo-del');
    if (del){
      const id = +del.closest('.row').dataset.id;
      if (del.dataset.confirm !== '1'){
        del.dataset.confirm = '1'; del.textContent = '⚠️';
        setTimeout(() => { if (del.dataset.confirm==='1'){ delete del.dataset.confirm; del.textContent='🗑'; } }, 4000);
        return;
      }
      delete del.dataset.confirm;
      try { await api('/todos/'+id, { method:'DELETE' }); await laden(); }
      catch(e){ alert('Konnte nicht gelöscht werden: ' + e.message); }
      return;
    }

    const cancel = ev.target.closest('.te-cancel');
    if (cancel){ cancel.closest('.todo-panel').classList.remove('on'); return; }

    const save = ev.target.closest('.te-save');
    if (save){
      const p = save.closest('.todo-panel');
      const id = p.dataset.id;
      const text = p.querySelector('.te-text').value.trim();
      const due = p.querySelector('.te-due').value;
      const thema = p.querySelector('.te-thema').value;
      const prio = p.querySelector('.te-prio').value;
      const msg = p.querySelector('.te-msg');
      if (!text){ msg.textContent = 'Text darf nicht leer sein'; msg.className = 'te-msg bad'; return; }
      save.disabled = true; save.textContent = 'speichert…';
      try {
        await api('/todos/'+id, { method:'PATCH', body: JSON.stringify({ text, due: due||null, thema: thema||null, prio: prio||null }) });
        await laden();
      } catch(e){
        msg.textContent = 'Fehler: '+e.message; msg.className = 'te-msg bad';
        save.disabled = false; save.textContent = 'Speichern';
      }
      return;
    }
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
    const teilrealisiert = rows.reduce((a,r) => a + (r.realizedPnl ? Number(r.realizedPnl) : 0), 0);
    const sum = withPnl.reduce((a,r) => a + Number(r.pnl), 0) + teilrealisiert;
    const wins = withPnl.filter(r => Number(r.pnl) > 0).length;
    ov.sumPnl = sum; renderOverview();
    document.getElementById('tstats').innerHTML =
      '<div class="stat"><div class="v">'+rows.filter(r=>r.exit==null).length+'</div><div class="l">offen</div></div>' +
      '<div class="stat"><div class="v">'+(withPnl.length?Math.round(wins/withPnl.length*100)+'%':'–')+'</div><div class="l">Winrate</div></div>' +
      '<div class="stat"><div class="v '+(sum>=0?'pnl-pos':'pnl-neg')+'">'+(withPnl.length?fmt(sum):'–')+'</div><div class="l">Σ PnL</div></div>';
    el.innerHTML = rows.slice(0,15).map(r => (
      '<div class="row"><span class="t">'+esc(r.name||r.asset)+'</span>' +
      '<span class="badge">'+esc(r.asset)+' '+esc(r.side)+'</span>' +
      (r.exit==null
        ? '<span class="badge amber">LIVE</span>' + (r.realizedPnl ? ' <span class="'+(Number(r.realizedPnl)>=0?'pnl-pos':'pnl-amber')+'">Teilgewinn '+fmt(r.realizedPnl)+'</span>' : '')
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
  // USD ist Bargeld, kein handelbarer Coin - Kurs ist trivial 1:1, kein API-Call noetig.
  if (String(ticker).toUpperCase() === 'USD') return { symbol: 'USD', last: 1 };
  try { return await api('/prices/'+encodeURIComponent(ticker)); }
  catch(e){ return null; }
}

let letzterPreisCheck = null;

function zeigePreisStamp(){
  const el = document.getElementById('preisStamp');
  if (!el) return;
  if (!letzterPreisCheck){ el.textContent = ''; return; }
  const sek = Math.max(0, Math.round((Date.now() - letzterPreisCheck) / 1000));
  const zeit = letzterPreisCheck.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  const vor = sek < 5 ? 'gerade eben' : sek < 60 ? 'vor '+sek+'s' : 'vor '+Math.floor(sek/60)+' Min';
  el.textContent = 'Kurse zuletzt aktualisiert: '+zeit+' ('+vor+')';
}
setInterval(zeigePreisStamp, 1000);

async function renderLivePos(){
  const el = document.getElementById('livepos');
  try {
    openTrades = await api('/trades/open');
    letzterPreisCheck = new Date(); zeigePreisStamp();
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
      const beSchon = o.sl != null && avg > 0 && (dir > 0 ? o.sl >= avg : o.sl <= avg);
      const slTxt = o.sl == null ? '<span class="muted">SL –</span>'
        : beSchon ? '<span class="badge amber">BE</span> '+o.sl
        : '<span class="badge red">SL</span> '+o.sl;
      parts.push(
        '<div class="row"><span class="t">'+esc(o.asset)+' '+esc(o.side)+' <span class="muted">@ '+
        avg.toLocaleString('de-DE',{maximumFractionDigits:4})+(last!=null?' → '+last.toLocaleString('de-DE',{maximumFractionDigits:4}):'')+
        '</span></span>'+pnlHtml+'</div>' +
        '<div class="muted" style="padding:0 0 6px 0">'+esc(o.name||'')+' · '+slTxt+' · TP '+(o.tp??'–')+
        (o.realizedPnl ? ' · <span class="'+(Number(o.realizedPnl)>=0?'pnl-pos':'pnl-amber')+'">realisiert '+fmt(o.realizedPnl)+'</span>' : '') +
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

document.getElementById('refreshPrices').addEventListener('click', async (ev) => {
  const btn = ev.currentTarget;
  const orig = btn.textContent;
  btn.disabled = true; btn.textContent = 'lädt…';
  try { await vielleichtAuffrischen(true); }
  finally {
    btn.textContent = 'aktualisiert ✓';
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1200);
  }
});

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

/* ---------- Portfolio: eigener Reiter auf der Trading-Seite fuer tatsaechlich
   gehaltene Coins (Spot/Wallets) - getrennt von den gehebelten Positionen oben. ---------- */
(function(){
  const FARBEN = ['#4f46e5','#059669','#d97706','#dc2626','#0891b2','#7c3aed','#db2777','#65a30d','#0284c7','#ea580c'];
  const elChart = document.getElementById('pfChart');
  const elList = document.getElementById('pfList');
  const elStamp = document.getElementById('pfStamp');
  const elForm = document.getElementById('pfForm');
  let holdings = [];
  let portfolios = [];
  let aktivesPortfolioId = null;
  let letzterPortfolioCheck = null;
  const elPfTabs = document.getElementById('pfTabs');
  const elPfPreisStamp = document.getElementById('pfPreisStamp');
  const refreshPortfolioBtn = document.getElementById('refreshPortfolio');

  function zeigePortfolioPreisStamp(){
    if (!elPfPreisStamp) return;
    if (!letzterPortfolioCheck){ elPfPreisStamp.textContent = ''; return; }
    const sek = Math.max(0, Math.round((Date.now() - letzterPortfolioCheck) / 1000));
    const zeit = letzterPortfolioCheck.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
    const vor = sek < 5 ? 'gerade eben' : sek < 60 ? 'vor '+sek+'s' : 'vor '+Math.floor(sek/60)+' Min';
    elPfPreisStamp.textContent = 'Kurse zuletzt aktualisiert: '+zeit+' ('+vor+')';
  }
  setInterval(zeigePortfolioPreisStamp, 1000);

  if (refreshPortfolioBtn) refreshPortfolioBtn.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'lädt…';
    try { await ladePortfolio(); }
    finally {
      btn.textContent = 'aktualisiert ✓';
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1200);
    }
  });

  const bitgetSyncBtn = document.getElementById('bitgetSyncBtn');
  const bitgetSyncErr = document.getElementById('bitgetSyncErr');
  if (bitgetSyncBtn) bitgetSyncBtn.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'synchronisiere…';
    if (bitgetSyncErr){ bitgetSyncErr.style.display = 'none'; bitgetSyncErr.textContent = ''; }
    try {
      await api('/bitget/sync-balances');
      await api('/bitget/sync-trades');
      await ladePortfolioListe();
      btn.textContent = 'synchronisiert ✓';
    } catch(e){
      btn.textContent = 'Fehler ✗';
      if (bitgetSyncErr){ bitgetSyncErr.style.display = 'block'; bitgetSyncErr.textContent = 'Bitget-Sync fehlgeschlagen: '+e.message; }
    } finally {
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
    }
  });

  const ledgerSyncBtn = document.getElementById('ledgerSyncBtn');
  const ledgerSyncErr = document.getElementById('ledgerSyncErr');
  if (ledgerSyncBtn) ledgerSyncBtn.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = 'synchronisiere…';
    if (ledgerSyncErr){ ledgerSyncErr.style.display = 'none'; ledgerSyncErr.textContent = ''; }
    try {
      const result = await api('/ledger/sync-balances');
      await ladePortfolioListe();
      if (result.errors && result.errors.length){
        btn.textContent = 'teilweise ✗';
        if (ledgerSyncErr){ ledgerSyncErr.style.display = 'block'; ledgerSyncErr.textContent = 'Ledger-Sync teilweise fehlgeschlagen: '+result.errors.map(e=>e.wallet+': '+e.error).join('; '); }
      } else {
        btn.textContent = 'synchronisiert ✓';
      }
    } catch(e){
      btn.textContent = 'Fehler ✗';
      if (ledgerSyncErr){ ledgerSyncErr.style.display = 'block'; ledgerSyncErr.textContent = 'Ledger-Sync fehlgeschlagen: '+e.message; }
    } finally {
      setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1500);
    }
  });

  async function ladePortfolioListe(){
    try { portfolios = await api('/portfolios'); }
    catch(e){ if (elPfTabs) elPfTabs.innerHTML = '<div class="err">Portfolios nicht ladbar: '+esc(e.message)+'</div>'; return; }
    if (!portfolios.some(p => p.id === aktivesPortfolioId)) {
      aktivesPortfolioId = portfolios.length ? portfolios[0].id : null;
    }
    renderPfTabs();
    ladePortfolio();
  }

  function renderPfTabs(){
    if (!elPfTabs) return;
    elPfTabs.innerHTML = portfolios.map(p =>
      '<button type="button" class="tab'+(p.id===aktivesPortfolioId?' active':'')+'" data-id="'+p.id+'">'+esc(p.name)+'</button>'
    ).join('') + (portfolios.length > 1
      ? '<span class="icon-btn del" id="pfDelBtn" title="Aktives Portfolio löschen" style="margin-left:6px">🗑</span>' : '');
    elPfTabs.querySelectorAll('.tab').forEach(btn => btn.addEventListener('click', () => {
      aktivesPortfolioId = +btn.dataset.id;
      renderPfTabs();
      ladePortfolio();
    }));
    const delBtn = document.getElementById('pfDelBtn');
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (delBtn.dataset.confirm !== '1'){
        delBtn.dataset.confirm = '1'; delBtn.textContent = '⚠️';
        setTimeout(() => { if (delBtn.dataset.confirm==='1'){ delete delBtn.dataset.confirm; delBtn.textContent='🗑'; } }, 4000);
        return;
      }
      try { await api('/portfolios/'+aktivesPortfolioId, { method:'DELETE' }); await ladePortfolioListe(); }
      catch(e){ alert('Konnte nicht gelöscht werden: '+e.message); }
    });
  }

  const pfNewPortfolioForm = document.getElementById('pfNewPortfolioForm');
  if (pfNewPortfolioForm) pfNewPortfolioForm.addEventListener('submit', async ev => {
    ev.preventDefault();
    const input = document.getElementById('pfNewPortfolioName');
    const name = input.value.trim();
    if (!name) return;
    try {
      const p = await api('/portfolios', { method:'POST', body: JSON.stringify({ name }) });
      input.value = '';
      aktivesPortfolioId = p.id;
      await ladePortfolioListe();
    } catch(e){ alert('Konnte nicht angelegt werden: '+e.message); }
  });

  function panel(h){
    return '<div class="todo-panel" data-id="'+h.id+'">' +
      '<div class="tp-line">' +
        '<input type="number" step="any" class="pf-amount" value="'+(h.amount??'')+'" placeholder="Menge">' +
        '<input type="number" step="any" class="pf-buy" value="'+(h.buyPrice??'')+'" placeholder="Kaufpreis Ø">' +
      '</div>' +
      '<div class="tp-line">' +
        '<input type="text" class="pf-wallet" value="'+esc(h.wallet||'')+'" placeholder="Wallet (optional)">' +
        '<input type="text" class="pf-chain" value="'+esc(h.chain||'')+'" placeholder="Chain (optional)">' +
      '</div>' +
      '<div class="tp-line">' +
        '<button type="button" class="pf-save">Speichern</button>' +
        '<button type="button" class="pf-cancel ghost">Abbrechen</button>' +
        '<span class="te-msg"></span>' +
      '</div>' +
    '</div>';
  }

  function zeile(h, preis, farbe){
    const last = preis && isFinite(preis.last) ? preis.last : null;
    const wert = last!=null ? h.amount*last : null;
    const kosten = h.buyPrice!=null ? h.amount*h.buyPrice : null;
    const pnl = (wert!=null && kosten!=null) ? wert-kosten : null;
    const pnlPct = (pnl!=null && kosten) ? pnl/kosten*100 : null;
    const beAbstandPct = (last!=null && h.buyPrice) ? (last-h.buyPrice)/h.buyPrice*100 : null;
    return '<div class="row" data-id="'+h.id+'">' +
      '<span class="pf-dot" style="background:'+farbe+'"></span>' +
      '<span class="t">'+esc(h.asset)+' <span class="muted">'+fmtAmount(h.amount)+' '+esc(h.ticker)+'</span></span>' +
      (wert!=null ? '<span>'+fmt(wert).replace('+','')+'</span>' : '<span class="muted">kein Kurs</span>') +
      (pnlPct!=null ? '<span class="'+(pnl>=0?'pnl-pos':'pnl-neg')+'">'+(pnlPct>=0?'+':'')+pnlPct.toFixed(1)+'%</span>' : '') +
      '<span class="row-actions">' +
        '<span class="icon-btn pf-edit-toggle" role="button" title="Bearbeiten">✎</span>' +
        '<span class="icon-btn del pf-del" role="button" title="Löschen">🗑</span>' +
      '</span>' +
    '</div>' +
    (h.buyPrice != null
      ? '<div class="muted" style="padding:0 0 6px 0">' +
          'Kurs '+(last!=null?fmt(last).replace('+',''):'–') +
          ' · BE-Preis '+fmt(h.buyPrice).replace('+','') +
          ' · Anfangswert '+fmt(kosten).replace('+','') +
          (pnl!=null ? ' · <span class="'+(pnl>=0?'pnl-pos':'pnl-neg')+'">'+(pnl>=0?'+':'')+fmt(pnl).replace('+','')+'</span>' : '') +
          (beAbstandPct!=null ? ' <span class="'+(beAbstandPct>=0?'pnl-pos':'pnl-neg')+'">('+(beAbstandPct>=0?'+':'')+beAbstandPct.toFixed(1)+'% vom BE)</span>' : '') +
        '</div>'
      : (last!=null ? '<div class="muted" style="padding:0 0 6px 0">Kurs '+fmt(last).replace('+','')+'</div>' : '')) +
    panel(h);
  }

  async function ladePortfolio(){
    if (!aktivesPortfolioId) { elChart.innerHTML = ''; elList.innerHTML = ''; return; }
    elChart.innerHTML = '<div class="empty">Lade…</div>';
    elList.innerHTML = '<div class="empty">Lade…</div>';
    try { holdings = await api('/portfolio?portfolioId='+aktivesPortfolioId); }
    catch(e){
      elChart.innerHTML = '<div class="err">Portfolio nicht ladbar: '+esc(e.message)+'</div>';
      elList.innerHTML = '';
      return;
    }
    if (!holdings.length){
      elChart.innerHTML = '<div class="empty">Noch keine Coins eingetragen – unten hinzufügen.</div>';
      elList.innerHTML = '<div class="empty">Keine Holdings</div>';
      elStamp.textContent = '';
      if (elPfPreisStamp) elPfPreisStamp.textContent = '';
      return;
    }
    // EIN Sammel-Request fuer alle Coins statt einer Einzelabfrage pro Coin -
    // frueher fuehrte das bei vielen Klicks auf "Aktualisieren" zu CoinGecko-Rate-Limits.
    const preise = {};
    const tickerListe = [...new Set(holdings.map(h => (h.ticker || h.asset).toUpperCase()))];
    try {
      const antwort = await api('/coinprices?tickers=' + encodeURIComponent(tickerListe.join(',')));
      holdings.forEach(h => {
        const t = (h.ticker || h.asset).toUpperCase();
        if (antwort.prices && antwort.prices[t]) preise[h.id] = antwort.prices[t];
      });
    } catch (e) {
      console.warn('Sammel-Kursabfrage fehlgeschlagen:', e.message);
    }
    letzterPortfolioCheck = new Date(); zeigePortfolioPreisStamp();

    // Staub (Restbetraege < 1 $) rausfiltern, damit Dust nicht die Liste zumuellt.
    // Werden nicht geloescht, nur eingeklappt - ueber den Zaehler unten einblendbar.
    const wertVon = h => {
      const p = preise[h.id];
      if (p && isFinite(p.last)) return h.amount*p.last;
      if (h.buyPrice != null) return h.amount*h.buyPrice;
      return null;
    };
    const staub = holdings.filter(h => { const w = wertVon(h); return w != null && w < 1; });
    holdings = holdings.filter(h => { const w = wertVon(h); return w == null || w >= 1; });
    // Groesste zuerst; Holdings ohne Kursdaten ans Ende.
    holdings.sort((a,b) => {
      const wa = wertVon(a), wb = wertVon(b);
      if (wa == null && wb == null) return 0;
      if (wa == null) return 1;
      if (wb == null) return -1;
      return wb - wa;
    });

    let gesamt = 0, gesamtKosten = 0, allePreise = true;
    holdings.forEach(h => {
      const p = preise[h.id];
      if (p && isFinite(p.last)) gesamt += h.amount*p.last; else allePreise = false;
      if (h.buyPrice != null) gesamtKosten += h.amount*h.buyPrice;
    });

    let cursor = 0;
    const stops = [];
    const segmente = [];
    holdings.forEach((h, idx) => {
      const p = preise[h.id];
      const wert = (p && isFinite(p.last)) ? h.amount*p.last : (h.buyPrice!=null ? h.amount*h.buyPrice : 0);
      const anteil = gesamt>0 ? wert/gesamt*100 : (holdings.length ? 100/holdings.length : 0);
      const farbe = FARBEN[idx % FARBEN.length];
      stops.push(farbe+' '+cursor.toFixed(2)+'% '+(cursor+anteil).toFixed(2)+'%');
      segmente.push({ h, anteil, farbe, mitte: cursor + anteil/2 });
      cursor += anteil;
    });
    const gradient = stops.length ? 'conic-gradient('+stops.join(', ')+')' : '#e5e7eb';

    // Ring-Beschriftung: kleine Linien vom Ring nach außen zu Asset+Prozent, wie bei
    // klassischen Asset-Allocation-Grafiken. Sehr kleine Anteile (<2%) werden übersprungen,
    // sonst überlappt sich der Text bei vielen Coins.
    const cx = 150, cy = 150, rRing = 85, rLinie = 95, rText = 122;
    const beschriftungen = segmente.filter(s => s.anteil >= 2).map(s => {
      const winkel = (s.mitte / 100) * 2 * Math.PI;
      const sin = Math.sin(winkel), cos = Math.cos(winkel);
      const x1 = cx + rRing*sin, y1 = cy - rRing*cos;
      const x2 = cx + rLinie*sin, y2 = cy - rLinie*cos;
      const xt = cx + rText*sin, yt = cy - rText*cos;
      const anchor = xt > cx + 4 ? 'start' : xt < cx - 4 ? 'end' : 'middle';
      const dx = anchor === 'start' ? 4 : anchor === 'end' ? -4 : 0;
      return '<line class="donut-label-line" x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'"/>' +
        '<text class="donut-label-text" x="'+(xt+dx).toFixed(1)+'" y="'+(yt-2).toFixed(1)+'" text-anchor="'+anchor+'">'+esc(s.h.asset)+'</text>' +
        '<text class="donut-label-pct" x="'+(xt+dx).toFixed(1)+'" y="'+(yt+10).toFixed(1)+'" text-anchor="'+anchor+'">'+s.anteil.toFixed(1)+'%</text>';
    }).join('');

    const pnlGesamt = gesamt - gesamtKosten;
    const pnlPctGesamt = gesamtKosten ? pnlGesamt/gesamtKosten*100 : null;

    elChart.innerHTML =
      '<div class="donut-wrap">' +
        '<div class="donut-labelbox">' +
          '<div class="donut-outer"><div class="donut" style="background:'+gradient+'"></div>' +
            '<div class="donut-hole"><div class="v">'+fmt(gesamt).replace('+','')+'</div><div class="l">Gesamtwert'+(allePreise?'':' (teilw.)')+'</div></div>' +
          '</div>' +
          '<svg class="donut-labels" viewBox="0 0 300 300">'+beschriftungen+'</svg>' +
        '</div>' +
        '<div class="pf-legend">' +
          holdings.map((h,idx) => {
            const p = preise[h.id];
            const wert = (p && isFinite(p.last)) ? h.amount*p.last : null;
            const anteil = (gesamt>0 && wert!=null) ? (wert/gesamt*100).toFixed(1)+'%' : '–';
            return '<div class="pf-legend-item"><span class="pf-dot" style="background:'+FARBEN[idx%FARBEN.length]+'"></span>' +
              '<span class="t">'+esc(h.asset)+'</span><span class="muted">'+anteil+'</span></div>';
          }).join('') +
          (pnlPctGesamt!=null ? '<div class="muted" style="margin-top:6px">Ø PnL: <span class="'+(pnlGesamt>=0?'pnl-pos':'pnl-neg')+'">'+(pnlPctGesamt>=0?'+':'')+pnlPctGesamt.toFixed(1)+'%</span></div>' : '') +
        '</div>' +
      '</div>';

    elStamp.textContent = holdings.length + ' Coin' + (holdings.length===1?'':'s') + (staub.length ? ' · '+staub.length+' Staub ausgeblendet' : '');

    let staubSichtbar = false;
    function renderListe(){
      elList.innerHTML = holdings.map((h,idx) => zeile(h, preise[h.id], FARBEN[idx%FARBEN.length])).join('') +
        (staubSichtbar ? staub.map((h,idx) => zeile(h, preise[h.id], FARBEN[(holdings.length+idx)%FARBEN.length])).join('') : '') +
        (staub.length ? '<div class="muted" style="padding:8px 0;cursor:pointer" id="pfStaubToggle" role="button">' +
          (staubSichtbar ? '▾ Staub-Positionen wieder ausblenden' : '▸ '+staub.length+' Staub-Position'+(staub.length===1?'':'en')+' anzeigen (< 1 $)') +
          '</div>' : '');
      const staubToggle = document.getElementById('pfStaubToggle');
      if (staubToggle) staubToggle.addEventListener('click', () => { staubSichtbar = !staubSichtbar; renderListe(); });
    }
    renderListe();
  }
  window.ladePortfolio = ladePortfolio;
  window.ladePortfolioListe = ladePortfolioListe;

  elForm.innerHTML =
    '<form class="ntform" id="pfNewForm">' +
      '<input type="text" id="pfAsset" placeholder="Asset (z.B. Solana)" required>' +
      '<input type="text" id="pfTicker" placeholder="Ticker (z.B. SOL)">' +
      '<input type="number" step="any" id="pfAmount" placeholder="Menge" required>' +
      '<input type="number" step="any" id="pfBuyPrice" placeholder="Kaufpreis Ø">' +
      '<input type="text" id="pfWallet" placeholder="Wallet (optional)">' +
      '<input type="text" id="pfChain" placeholder="Chain (optional)">' +
      '<button type="submit" class="btn">Hinzufügen</button>' +
    '</form><div class="err" id="pfErr" style="display:none"></div>';

  document.getElementById('pfNewForm').addEventListener('submit', async ev => {
    ev.preventDefault();
    const errEl = document.getElementById('pfErr');
    errEl.style.display = 'none';
    const asset = document.getElementById('pfAsset').value.trim();
    const ticker = document.getElementById('pfTicker').value.trim();
    try {
      await api('/portfolio', { method:'POST', body: JSON.stringify({
        portfolioId: aktivesPortfolioId,
        asset, ticker: ticker || asset,
        amount: parseFloat(document.getElementById('pfAmount').value),
        buyPrice: parseFloat(document.getElementById('pfBuyPrice').value) || null,
        wallet: document.getElementById('pfWallet').value.trim() || null,
        chain: document.getElementById('pfChain').value.trim() || null
      })});
      document.getElementById('pfNewForm').reset();
      ladePortfolio();
    } catch(e){ errEl.textContent = e.message; errEl.style.display = 'block'; }
  });

  document.addEventListener('click', async ev => {
    if (!ev.target.closest('#pfList')) return;

    const editTgl = ev.target.closest('.pf-edit-toggle');
    if (editTgl){
      const row = editTgl.closest('.row');
      const p = row && row.nextElementSibling;
      if (p && p.classList.contains('todo-panel')) p.classList.toggle('on');
      return;
    }

    const del = ev.target.closest('.pf-del');
    if (del){
      const id = +del.closest('.row').dataset.id;
      if (del.dataset.confirm !== '1'){
        del.dataset.confirm = '1'; del.textContent = '⚠️';
        setTimeout(() => { if (del.dataset.confirm==='1'){ delete del.dataset.confirm; del.textContent='🗑'; } }, 4000);
        return;
      }
      delete del.dataset.confirm;
      try { await api('/portfolio/'+id, { method:'DELETE' }); await ladePortfolio(); }
      catch(e){ alert('Konnte nicht gelöscht werden: '+e.message); }
      return;
    }

    const cancel = ev.target.closest('.pf-cancel');
    if (cancel){ cancel.closest('.todo-panel').classList.remove('on'); return; }

    const save = ev.target.closest('.pf-save');
    if (save){
      const p = save.closest('.todo-panel');
      const id = p.dataset.id;
      const amount = parseFloat(p.querySelector('.pf-amount').value);
      const buyPrice = parseFloat(p.querySelector('.pf-buy').value);
      const wallet = p.querySelector('.pf-wallet').value.trim();
      const chain = p.querySelector('.pf-chain').value.trim();
      const msg = p.querySelector('.te-msg');
      if (!isFinite(amount)){ msg.textContent = 'Menge fehlt'; msg.className = 'te-msg bad'; return; }
      save.disabled = true; save.textContent = 'speichert…';
      try {
        await api('/portfolio/'+id, { method:'PATCH', body: JSON.stringify({
          amount, buyPrice: isFinite(buyPrice)?buyPrice:null, wallet: wallet||null, chain: chain||null
        })});
        await ladePortfolio();
      } catch(e){ msg.textContent = 'Fehler: '+e.message; msg.className = 'te-msg bad'; save.disabled=false; save.textContent='Speichern'; }
      return;
    }
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

/* Beim Wechsel auf eine Seite deren Daten neu holen. Vorher wurden Historie,
   To-Dos und Marktlage nur ein einziges Mal beim Laden geholt – wer die Seite
   offen liegen liess, sah dort ewig den alten Stand. */
function seiteAuffrischen(id){
  if (id === 'trading'){ vielleichtAuffrischen(); ladeHistorie(); }
  else if (id === 'todos'){ if (window.ladeTodos) window.ladeTodos(); if (window.ladeKalenderMonat) window.ladeKalenderMonat(); }
  else if (id === 'disziplin'){ if (window.ladeReading) window.ladeReading(); }
  else if (id === 'news'){ ladeMacro(); ladeNews(); }
  else if (id === 'uebersicht'){ ladeMacro(); ladeHistorie(); ladeKalender(); ladeOvTrades(); if (window.ladeTodos) window.ladeTodos(); }
  else if (id === 'portfolio'){ if (window.ladePortfolioListe) window.ladePortfolioListe(); }
}

document.addEventListener('visibilitychange', () => { if (tradingSichtbar()) vielleichtAuffrischen(); });
document.querySelectorAll('nav.side button[data-page]').forEach(b =>
  b.addEventListener('click', () => seiteAuffrischen(b.dataset.page)));

ladeMacro(); ladeNews(); ladeHistorie(); ladeKalender(); ladeOvTrades();
renderLivePos().then(() => { letzteAktualisierung = Date.now(); });
setInterval(() => vielleichtAuffrischen(), AKTUALISIERUNG_MS);
