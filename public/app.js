/* ---------- Dark Mode: Umschalter oben rechts, gilt auf jeder Seite ---------- */
(function(){
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const istDunkel = () => document.documentElement.getAttribute('data-theme') === 'dark';
  function setzen(dunkel){
    if (dunkel) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('theme', dunkel ? 'dark' : 'light'); } catch(e){}
    btn.textContent = dunkel ? '☀️' : '🌙';
  }
  setzen(istDunkel());
  btn.addEventListener('click', () => setzen(!istDunkel()));
})();

const esc = s => String(s ?? '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));

// Coin-Icons: liegen als SVG unter /icons/<datei>.svg. COIN_ICON_ALIAS bildet
// Ticker ab, deren Icon-Dateiname vom Ticker abweicht (z.B. RENDER -> render.svg
// heisst intern noch "render", war frueher unter RNDR bekannt).
const COIN_ICONS = new Set(['eth','link','sui','render']);
const COIN_ICON_ALIAS = { rndr: 'render' };
function coinIcon(ticker, name){
  const key = String(ticker || name || '').toLowerCase();
  const file = COIN_ICON_ALIAS[key] || key;
  if (COIN_ICONS.has(file)) return '<img class="coin-icon" src="/icons/'+file+'.svg" alt="">';
  const buchstabe = esc((ticker || name || '?').trim().charAt(0).toUpperCase() || '?');
  return '<span class="coin-icon coin-icon-fallback">'+buchstabe+'</span>';
}
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

/* ---------- Journal Day + Jahres-/Monatsfortschritt (Uebersicht) ----------
   Tag 1 = 31.03.2025, d.h. der 12.09.2026 ist Journal Day 531. Reine Datumsrechnung
   im Browser, nichts gespeichert - der Zaehler laeuft dadurch automatisch weiter. */
(function(){
  const elNum = document.getElementById('jdNum');
  if (!elNum) return;
  const START = Date.UTC(2025, 2, 31);   // Monat 2 = Maerz

  // Tagesdifferenzen immer ueber UTC-Stempel rechnen: lokale Mitternachts-Daten
  // unterscheiden sich bei Sommer-/Winterzeit um eine Stunde, dadurch wuerde
  // Math.floor sonst einen Tag zu wenig liefern.
  function tagStempel(d){ return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }

  function zeichne(){
    const jetzt = new Date();
    const heute = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate());
    const heuteUtc = tagStempel(heute);
    const tagNr = Math.round((heuteUtc - START) / 86400000) + 1;
    elNum.textContent = tagNr.toLocaleString('de-DE');
    document.getElementById('jdSince').textContent =
      'seit ' + new Date(START).toLocaleDateString('de-DE',
        { day:'2-digit', month:'long', year:'numeric', timeZone:'UTC' });

    const jahr = heute.getFullYear();
    const jahresStartUtc = Date.UTC(jahr, 0, 1);
    const tageImJahr = Math.round((Date.UTC(jahr, 11, 31) - jahresStartUtc) / 86400000) + 1;
    const tagImJahr = Math.round((heuteUtc - jahresStartUtc) / 86400000) + 1;

    const tageImMonat = new Date(jahr, heute.getMonth() + 1, 0).getDate();
    const tagImMonat = heute.getDate();

    function setzen(prefix, tag, gesamt, titel){
      const pct = Math.max(0, Math.min(100, tag / gesamt * 100));
      document.getElementById(prefix+'Label').textContent = titel;
      document.getElementById(prefix+'Pct').textContent = Math.round(pct) + ' %';
      document.getElementById(prefix+'Fill').style.width = pct.toFixed(1) + '%';
      document.getElementById(prefix+'Sub').textContent =
        'Tag ' + tag + ' von ' + gesamt + ' · noch ' + (gesamt - tag) + ' Tage';
    }
    setzen('jdYear', tagImJahr, tageImJahr, String(jahr));
    setzen('jdMonth', tagImMonat, tageImMonat,
      heute.toLocaleDateString('de-DE',{month:'long'}));
  }

  zeichne();
  // Falls die Seite ueber Mitternacht offen bleibt: stuendlich nachrechnen.
  setInterval(zeichne, 3600000);
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
      return '<div class="row"><span class="t">'+coinIcon(o.ticker, o.asset)+' '+esc(o.asset)+' <span class="muted">'+esc(o.side)+'</span></span>'+pnlHtml+'</div>' +
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
  let aktuelleEvents = [];

  // Termin-Modal (Bearbeiten/Löschen)
  const modal = document.getElementById('calEventModal');
  const ceForm = document.getElementById('calEventForm');
  const ceTitle = document.getElementById('ceTitle');
  const ceDate = document.getElementById('ceDate');
  const ceTime = document.getElementById('ceTime');
  const ceAllDay = document.getElementById('ceAllDay');
  const ceLocation = document.getElementById('ceLocation');
  const ceSave = document.getElementById('ceSave');
  const ceDelete = document.getElementById('ceDelete');
  const ceCancel = document.getElementById('ceCancel');
  const ceMsg = document.getElementById('ceMsg');

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

    aktuelleEvents = events;
    const heute = new Date(); heute.setHours(0,0,0,0);
    const tage = [];
    for (let d = new Date(gridStart); d <= gridEnde; d.setDate(d.getDate()+1)) tage.push(new Date(d));

    grid.innerHTML = tage.map(tag => {
      const inMonat = tag.getMonth() === aktMonat.getMonth();
      const istHeute = tag.toDateString() === heute.toDateString();
      const istWochenende = tag.getDay() === 0 || tag.getDay() === 6;
      const tagEvents = events.filter(ev => evDatum(ev).toDateString() === tag.toDateString());
      const evHtml = tagEvents.slice(0,3).map(ev => '<div class="cal-ev" data-id="'+esc(ev.id)+'" title="'+esc(ev.title)+'">'+esc(ev.title)+'</div>').join('') +
        (tagEvents.length > 3 ? '<div class="muted">+'+(tagEvents.length-3)+' mehr</div>' : '');
      return '<div class="cal-day'+(inMonat?'':' other')+(istHeute?' today':'')+(istWochenende?' weekend':'')+'"><div class="dnum">'+tag.getDate()+'</div>'+evHtml+'</div>';
    }).join('');
  }

  function oeffneModal(ev){
    ceMsg.textContent = ''; ceMsg.classList.remove('bad');
    ceForm.dataset.id = ev.id;
    ceTitle.value = ev.title === '(ohne Titel)' ? '' : (ev.title || '');
    ceLocation.value = ev.location || '';
    ceAllDay.checked = !!ev.allDay;
    ceTime.disabled = !!ev.allDay;
    if (ev.allDay){
      ceDate.value = ev.start;
      ceTime.value = '';
    } else {
      const d = new Date(ev.start);
      ceDate.value = d.toLocaleDateString('sv-SE');
      ceTime.value = d.toTimeString().slice(0,5);
    }
    modal.hidden = false;
  }

  function schliesseModal(){
    modal.hidden = true;
    delete ceForm.dataset.id;
    delete ceDelete.dataset.confirm;
    ceDelete.textContent = 'Löschen';
    ceDelete.disabled = false;
  }

  grid.addEventListener('click', ev => {
    const el = ev.target.closest('.cal-ev');
    if (!el) return;
    const found = aktuelleEvents.find(e => e.id === el.dataset.id);
    if (found) oeffneModal(found);
  });

  modal.addEventListener('click', ev => { if (ev.target === modal) schliesseModal(); });
  ceCancel.addEventListener('click', schliesseModal);

  ceAllDay.addEventListener('change', () => { ceTime.disabled = ceAllDay.checked; });

  ceForm.addEventListener('submit', async ev => {
    ev.preventDefault();
    const id = ceForm.dataset.id;
    if (!id) return;
    const title = ceTitle.value.trim();
    if (!title){ ceMsg.textContent = 'Titel fehlt.'; ceMsg.classList.add('bad'); return; }
    if (!ceDate.value){ ceMsg.textContent = 'Datum fehlt.'; ceMsg.classList.add('bad'); return; }
    const allDay = ceAllDay.checked;
    const start = allDay ? ceDate.value : new Date(ceDate.value + 'T' + (ceTime.value || '00:00') + ':00').toISOString();
    ceMsg.textContent = ''; ceMsg.classList.remove('bad');
    ceSave.disabled = true; ceSave.textContent = 'speichert…';
    try {
      await api('/calendar/' + encodeURIComponent(id), {
        method: 'PATCH',
        body: JSON.stringify({ title, location: ceLocation.value.trim(), allDay, start })
      });
      schliesseModal();
      await laden();
    } catch(e){ ceMsg.textContent = 'Fehler: ' + e.message; ceMsg.classList.add('bad'); }
    finally { ceSave.disabled = false; ceSave.textContent = 'Speichern'; }
  });

  ceDelete.addEventListener('click', async () => {
    const id = ceForm.dataset.id;
    if (!id) return;
    if (ceDelete.dataset.confirm !== '1'){
      ceDelete.dataset.confirm = '1'; ceDelete.textContent = 'Wirklich löschen?';
      setTimeout(() => { if (ceDelete.dataset.confirm==='1'){ delete ceDelete.dataset.confirm; ceDelete.textContent = 'Löschen'; } }, 4000);
      return;
    }
    delete ceDelete.dataset.confirm;
    ceDelete.disabled = true; ceDelete.textContent = 'löscht…';
    try {
      await api('/calendar/' + encodeURIComponent(id), { method: 'DELETE' });
      schliesseModal();
      await laden();
    } catch(e){
      ceMsg.textContent = 'Fehler: ' + e.message; ceMsg.classList.add('bad');
      ceDelete.disabled = false; ceDelete.textContent = 'Löschen';
    }
  });

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
  const elBoard = document.getElementById('todoBoard');
  const elOvTodos = document.getElementById('ovTodos');
  const elOvBeob = document.getElementById('ovBeobachten');
  const THEMEN_VORSCHLAEGE = ['Trading','Beobachten','Dashboard','Sport','Arbeit','Privat','Sonstiges'];
  let rows = [];
  let ansicht = 'offen';

  function themaSlug(th){
    return (th || 'ohne').toLowerCase().replace(/[^a-z0-9äöüß]+/g,'-').replace(/^-+|-+$/g,'') || 'ohne';
  }

  function renderThemaDatalist(){
    const dl = document.getElementById('themaSuggest');
    if (!dl) return;
    const themen = Array.from(new Set([...THEMEN_VORSCHLAEGE, ...rows.map(r => r.thema).filter(Boolean)]))
      .sort((a,b) => a.localeCompare(b,'de'));
    dl.innerHTML = themen.map(th => '<option value="'+esc(th)+'">').join('');
  }

  function panel(r){
    const prioOpts = '<option value="">Priorität…</option>' + ['Hoch','Mittel','Niedrig'].map(p =>
      '<option'+(r.prio===p?' selected':'')+'>'+p+'</option>').join('');
    return '<div class="todo-panel" data-id="'+r.id+'">' +
      '<div class="tp-line"><input type="text" class="te-text" maxlength="200" value="'+esc(r.text)+'" placeholder="Aufgabe"></div>' +
      '<div class="tp-line">' +
        '<input type="date" class="te-due" value="'+(r.due ? String(r.due).slice(0,10) : '')+'">' +
        '<input type="text" class="te-thema" list="themaSuggest" maxlength="40" value="'+esc(r.thema||'')+'" placeholder="Thema…">' +
        '<select class="te-prio">'+prioOpts+'</select>' +
      '</div>' +
      '<div class="tp-line">' +
        '<button type="button" class="te-save">Speichern</button>' +
        '<button type="button" class="te-cancel ghost">Abbrechen</button>' +
        '<span class="te-msg"></span>' +
      '</div>' +
    '</div>';
  }

  function zeile(r, hideThema){
    return '<div class="row" data-id="'+r.id+'">' +
      '<span class="tcb'+(r.done?' done':'')+'" role="button">'+(r.done?'✓':'○')+'</span>' +
      '<span class="t">'+esc(r.text)+'</span>' +
      (r.prio ? '<span class="badge'+(r.prio==='Hoch'?' red':r.prio==='Mittel'?' amber':'')+'">'+esc(r.prio)+'</span>' : '') +
      (r.thema && !hideThema ? '<span class="badge">'+esc(r.thema)+'</span>' : '') +
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

    ov.todos = rows.filter(r => !r.done).length; renderOverview();

    // ToDo-Seite: eigene Spalte pro Thema, nebeneinander
    if (elBoard){
      const themen = Array.from(new Set(gefiltert.map(r => r.thema).filter(Boolean))).sort((a,b) => a.localeCompare(b,'de'));
      const ohneThema = sortiert(gefiltert.filter(r => !r.thema));
      const spalten = [];
      if (ohneThema.length || !themen.length) spalten.push({ label:'Ohne Thema', liste: ohneThema });
      themen.forEach(th => spalten.push({ label: th, liste: sortiert(gefiltert.filter(r => r.thema === th)) }));

      elBoard.innerHTML = spalten.map(sp =>
        '<div class="card todo-col" data-thema-slug="'+themaSlug(sp.label==='Ohne Thema'?'':sp.label)+'">' +
          '<h2>'+esc(sp.label)+' <span class="sub">'+sp.liste.length+'</span></h2>' +
          '<div class="todo-col-list">' + (sp.liste.length ? sp.liste.map(r => zeile(r, true)).join('') :
            '<div class="empty">'+(ansicht==='erledigt' ? 'Noch nichts erledigt' : 'Keine Einträge')+'</div>') +
          '</div>' +
        '</div>'
      ).join('') || '<div class="empty">'+(ansicht==='erledigt' ? 'Noch nichts erledigt' : 'Keine offenen To-Dos')+'</div>';
    }

    // Übersicht-Seite: kompakte Vorschau, "Beobachten" weiterhin eigens hervorgehoben
    const normal = sortiert(gefiltert.filter(r => r.thema !== 'Beobachten'));
    const beob = sortiert(gefiltert.filter(r => r.thema === 'Beobachten'));
    const normalOffen = normal.filter(r => !r.done);
    const beobOffen = beob.filter(r => !r.done);
    if (elOvTodos) elOvTodos.innerHTML = normalOffen.length ? normalOffen.slice(0,6).map(zeile).join('') : '<div class="empty">Alles erledigt ✨</div>';
    if (elOvBeob) elOvBeob.innerHTML = beobOffen.length ? beobOffen.slice(0,6).map(zeile).join('') : '<div class="empty">Nichts zu beobachten</div>';

    renderThemaDatalist();
  }

  async function laden(){
    try { rows = await api('/todos'); zeichne(); }
    catch(e){
      const msg = '<div class="err">To-Dos nicht ladbar: '+esc(e.message)+'</div>';
      [elBoard, elOvTodos, elOvBeob].forEach(el => { if (el) el.innerHTML = msg; });
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
    if (!ev.target.closest('#todoBoard, #ovTodos, #ovBeobachten')) return;

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
      const thema = p.querySelector('.te-thema').value.trim();
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

  const ntToggle = document.getElementById('ntToggle');
  const ntForm = document.getElementById('todoAdd');
  if (ntToggle && ntForm){
    ntToggle.addEventListener('click', () => {
      ntForm.hidden = !ntForm.hidden;
      if (!ntForm.hidden) document.getElementById('ntText').focus();
    });
  }

  document.getElementById('todoAdd').addEventListener('submit', async ev => {
    ev.preventDefault();
    const text = document.getElementById('ntText').value.trim();
    if (!text) return;
    const due = document.getElementById('ntDue').value;
    const thema = document.getElementById('ntThema').value.trim();
    try {
      await api('/todos', { method:'POST', body: JSON.stringify({ text, due: due||null, thema: thema||null }) });
      document.getElementById('ntText').value = ''; document.getElementById('ntDue').value = '';
      document.getElementById('ntThema').value = ''; ntForm.hidden = true; await laden();
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

/* ---------- Double-Bottom-Watchlist: urspruenglich aus Obsidian importiert, jetzt direkt
   im Dashboard pflegbar (DB-Tabelle watchlist_signals, /api/watchlist). ---------- */
// Ergebnis eines Signals. Bei Breakeven wird unterschieden, ob das Setup vorher
// geliefert hat: be_win = 2R erreicht (SL stand schon auf BE), be_loss = 2R nie erreicht.
const WL_FARBEN = { win:'var(--green)', be_win:'var(--amber)', be_loss:'var(--orange)',
  lose:'var(--red)', no_entry:'var(--accent)', '':'var(--muted)' };
const WL_LABEL = { win:'Win', be_win:'BE Win', be_loss:'BE Loss', lose:'Lose',
  no_entry:'No Entry', '':'Noch nicht bewertet' };
const WL_STATUS_HINT = { win:'Win', be_win:'BE Win (2R erreicht)',
  be_loss:'BE Loss (2R nicht erreicht)', lose:'Lose',
  no_entry:'No Entry (kein Einstieg, aber auch nicht gefallen)', '':'Noch nicht bewertet' };
const WL_FORM_LABEL = { bogen:'Bogen', bogen_unsauber:'Bogen unsauber', kein_bogen:'kein Bogen', '':'' };
// Chart-Eigenschaften, aus denen zusammen mit der eigenen Einschaetzung die Note entsteht
const WL_PHASE_LABEL = { uptrend:'Uptrend', downtrend:'Downtrend', ranging:'Range', '':'–' };
const WL_PATTERN_LABEL = { valid:'valid', clean:'clean', choppy:'choppy', '':'–' };
const WL_CANDLE_LABEL = { pivot:'Pivot Candles', decent:'Decent Candles', gap:'Gap Candles', mini:'Mini Candles', '':'–' };
const WL_DIV_LABEL = { rsi:'RSI Div.', none:'No Div.', hidden:'RSI Hidden Div.', '':'–' };
const WL_DIV_KURZ = { rsi:'RSI', none:'keine', hidden:'Hidden', '':'–' };
const wlStatus = s => s.status || '';
// Setup-Qualitaet (bewertet das Signal selbst, unabhaengig vom Ausgang des Trades)
const WL_NOTEN = ['A++', 'A+', 'A', 'B'];
const WL_NOTE_FARBEN = { 'A++':'var(--green)', 'A+':'var(--green)', 'A':'var(--amber)', 'B':'var(--muted)' };
// Feste Farbpalette fuer Trades. Die Farbe haengt nur an der Trade-ID, bleibt also
// beim Umsortieren gleich; die Nummer steht immer daneben, Farbe allein traegt nichts.
const WL_TRADE_FARBEN = ['#8b5cf6','#0ea5e9','#c026d3','#65a30d','#06b6d4','#7c3aed','#2563eb','#db2777'];
function wlTradeFarbe(tid){
  const t = String(tid); let h = 0;
  for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  return WL_TRADE_FARBEN[h % WL_TRADE_FARBEN.length];
}
// Signale mit derselben Trade-ID gehoeren zu EINEM Trade. Ohne ID zaehlt jedes
// Signal fuer sich - Schluessel dann eindeutig ueber die Zeilen-ID.
const wlTradeKey = s => (s.tradeId && String(s.tradeId).trim()) ? 't:' + String(s.tradeId).trim() : 'e:' + s.id;

// Kurzfassung des Setups fuer die Tabellenspalte, z.B. "Double · MTF 2 · Multi-Asset · Bogen"
function wlSetupText(s){
  const teile = [];
  if (s.eventTyp) teile.push(s.eventTyp === 'double' ? 'Double' : 'Single');
  if (s.mtf > 1) teile.push('MTF ' + s.mtf);
  if (s.multiAsset) teile.push('Multi-Asset');
  if (s.form) teile.push(WL_FORM_LABEL[s.form] || s.form);
  return teile.join(' · ');
}

/* Tägliche BTC/USD-Schlusskurse (Binance BTCUSDT, 01.06.2021–heute) – Hintergrund für den Zyklus-Chart. */
const BTC_DAILY = [["2021-06-01",36693],["2021-06-02",37569],["2021-06-03",39247],["2021-06-04",36829],["2021-06-05",35513],["2021-06-06",35796],["2021-06-07",33553],["2021-06-08",33381],["2021-06-09",37388],["2021-06-10",36676],["2021-06-11",37332],["2021-06-12",35546],["2021-06-13",39021],["2021-06-14",40516],["2021-06-15",40144],["2021-06-16",38349],["2021-06-17",38093],["2021-06-18",35820],["2021-06-19",35484],["2021-06-20",35600],["2021-06-21",31609],["2021-06-22",32510],["2021-06-23",33678],["2021-06-24",34663],["2021-06-25",31584],["2021-06-26",32284],["2021-06-27",34700],["2021-06-28",34495],["2021-06-29",35912],["2021-06-30",35045],["2021-07-01",33505],["2021-07-02",33787],["2021-07-03",34669],["2021-07-04",35287],["2021-07-05",33690],["2021-07-06",34220],["2021-07-07",33862],["2021-07-08",32876],["2021-07-09",33816],["2021-07-10",33503],["2021-07-11",34259],["2021-07-12",33087],["2021-07-13",32730],["2021-07-14",32820],["2021-07-15",31880],["2021-07-16",31384],["2021-07-17",31520],["2021-07-18",31779],["2021-07-19",30840],["2021-07-20",29790],["2021-07-21",32145],["2021-07-22",32288],["2021-07-23",33634],["2021-07-24",34258],["2021-07-25",35381],["2021-07-26",37238],["2021-07-27",39458],["2021-07-28",40020],["2021-07-29",40016],["2021-07-30",42206],["2021-07-31",41462],["2021-08-01",39845],["2021-08-02",39148],["2021-08-03",38207],["2021-08-04",39723],["2021-08-05",40862],["2021-08-06",42837],["2021-08-07",44573],["2021-08-08",43794],["2021-08-09",46253],["2021-08-10",45585],["2021-08-11",45511],["2021-08-12",44399],["2021-08-13",47800],["2021-08-14",47069],["2021-08-15",46974],["2021-08-16",45901],["2021-08-17",44696],["2021-08-18",44705],["2021-08-19",46761],["2021-08-20",49322],["2021-08-21",48822],["2021-08-22",49239],["2021-08-23",49489],["2021-08-24",47674],["2021-08-25",48973],["2021-08-26",46844],["2021-08-27",49070],["2021-08-28",48895],["2021-08-29",48768],["2021-08-30",46983],["2021-08-31",47101],["2021-09-01",48811],["2021-09-02",49247],["2021-09-03",49999],["2021-09-04",49916],["2021-09-05",51757],["2021-09-06",52664],["2021-09-07",46864],["2021-09-08",46048],["2021-09-09",46395],["2021-09-10",44851],["2021-09-11",45174],["2021-09-12",46025],["2021-09-13",44941],["2021-09-14",47112],["2021-09-15",48121],["2021-09-16",47738],["2021-09-17",47300],["2021-09-18",48293],["2021-09-19",47242],["2021-09-20",43016],["2021-09-21",40734],["2021-09-22",43544],["2021-09-23",44865],["2021-09-24",42811],["2021-09-25",42671],["2021-09-26",43161],["2021-09-27",42147],["2021-09-28",41027],["2021-09-29",41524],["2021-09-30",43824],["2021-10-01",48142],["2021-10-02",47635],["2021-10-03",48200],["2021-10-04",49225],["2021-10-05",51472],["2021-10-06",55315],["2021-10-07",53785],["2021-10-08",53951],["2021-10-09",54950],["2021-10-10",54659],["2021-10-11",57471],["2021-10-12",55997],["2021-10-13",57367],["2021-10-14",57348],["2021-10-15",61672],["2021-10-16",60876],["2021-10-17",61528],["2021-10-18",62010],["2021-10-19",64281],["2021-10-20",66001],["2021-10-21",62193],["2021-10-22",60688],["2021-10-23",61287],["2021-10-24",60852],["2021-10-25",63079],["2021-10-26",60329],["2021-10-27",58413],["2021-10-28",60576],["2021-10-29",62254],["2021-10-30",61859],["2021-10-31",61300],["2021-11-01",60911],["2021-11-02",63220],["2021-11-03",62896],["2021-11-04",61395],["2021-11-05",60937],["2021-11-06",61471],["2021-11-07",63274],["2021-11-08",67526],["2021-11-09",66948],["2021-11-10",64882],["2021-11-11",64774],["2021-11-12",64122],["2021-11-13",64380],["2021-11-14",65519],["2021-11-15",63607],["2021-11-16",60059],["2021-11-17",60345],["2021-11-18",56892],["2021-11-19",58052],["2021-11-20",59708],["2021-11-21",58622],["2021-11-22",56247],["2021-11-23",57541],["2021-11-24",57138],["2021-11-25",58960],["2021-11-26",53727],["2021-11-27",54721],["2021-11-28",57275],["2021-11-29",57776],["2021-11-30",56951],["2021-12-01",57184],["2021-12-02",56480],["2021-12-03",53601],["2021-12-04",49152],["2021-12-05",49396],["2021-12-06",50442],["2021-12-07",50589],["2021-12-08",50471],["2021-12-09",47546],["2021-12-10",47141],["2021-12-11",49390],["2021-12-12",50054],["2021-12-13",46703],["2021-12-14",48343],["2021-12-15",48865],["2021-12-16",47632],["2021-12-17",46131],["2021-12-18",46834],["2021-12-19",46681],["2021-12-20",46914],["2021-12-21",48890],["2021-12-22",48588],["2021-12-23",50839],["2021-12-24",50820],["2021-12-25",50400],["2021-12-26",50775],["2021-12-27",50701],["2021-12-28",47544],["2021-12-29",46465],["2021-12-30",47121],["2021-12-31",46217],["2022-01-01",47723],["2022-01-02",47286],["2022-01-03",46446],["2022-01-04",45832],["2022-01-05",43451],["2022-01-06",43082],["2022-01-07",41566],["2022-01-08",41680],["2022-01-09",41865],["2022-01-10",41822],["2022-01-11",42729],["2022-01-12",43903],["2022-01-13",42560],["2022-01-14",43060],["2022-01-15",43084],["2022-01-16",43072],["2022-01-17",42202],["2022-01-18",42352],["2022-01-19",41660],["2022-01-20",40681],["2022-01-21",36445],["2022-01-22",35071],["2022-01-23",36245],["2022-01-24",36660],["2022-01-25",36958],["2022-01-26",36809],["2022-01-27",37160],["2022-01-28",37717],["2022-01-29",38167],["2022-01-30",37882],["2022-01-31",38467],["2022-02-01",38695],["2022-02-02",36896],["2022-02-03",37312],["2022-02-04",41574],["2022-02-05",41383],["2022-02-06",42381],["2022-02-07",43840],["2022-02-08",44043],["2022-02-09",44373],["2022-02-10",43495],["2022-02-11",42374],["2022-02-12",42218],["2022-02-13",42054],["2022-02-14",42536],["2022-02-15",44545],["2022-02-16",43874],["2022-02-17",40516],["2022-02-18",39974],["2022-02-19",40079],["2022-02-20",38387],["2022-02-21",37008],["2022-02-22",38230],["2022-02-23",37250],["2022-02-24",38327],["2022-02-25",39219],["2022-02-26",39117],["2022-02-27",37699],["2022-02-28",43160],["2022-03-01",44421],["2022-03-02",43893],["2022-03-03",42454],["2022-03-04",39149],["2022-03-05",39398],["2022-03-06",38421],["2022-03-07",37988],["2022-03-08",38731],["2022-03-09",41942],["2022-03-10",39422],["2022-03-11",38730],["2022-03-12",38807],["2022-03-13",37777],["2022-03-14",39671],["2022-03-15",39280],["2022-03-16",41114],["2022-03-17",40918],["2022-03-18",41758],["2022-03-19",42201],["2022-03-20",41262],["2022-03-21",41002],["2022-03-22",42364],["2022-03-23",42883],["2022-03-24",43991],["2022-03-25",44313],["2022-03-26",44511],["2022-03-27",46828],["2022-03-28",47122],["2022-03-29",47435],["2022-03-30",47068],["2022-03-31",45510],["2022-04-01",46283],["2022-04-02",45811],["2022-04-03",46407],["2022-04-04",46581],["2022-04-05",45498],["2022-04-06",43170],["2022-04-07",43444],["2022-04-08",42252],["2022-04-09",42754],["2022-04-10",42159],["2022-04-11",39530],["2022-04-12",40075],["2022-04-13",41148],["2022-04-14",39942],["2022-04-15",40552],["2022-04-16",40379],["2022-04-17",39678],["2022-04-18",40801],["2022-04-19",41493],["2022-04-20",41358],["2022-04-21",40480],["2022-04-22",39709],["2022-04-23",39442],["2022-04-24",39450],["2022-04-25",40426],["2022-04-26",38113],["2022-04-27",39236],["2022-04-28",39742],["2022-04-29",38596],["2022-04-30",37631],["2022-05-01",38468],["2022-05-02",38525],["2022-05-03",37729],["2022-05-04",39690],["2022-05-05",36553],["2022-05-06",36014],["2022-05-07",35472],["2022-05-08",34038],["2022-05-09",30076],["2022-05-10",31017],["2022-05-11",29104],["2022-05-12",29030],["2022-05-13",29287],["2022-05-14",30087],["2022-05-15",31329],["2022-05-16",29874],["2022-05-17",30445],["2022-05-18",28715],["2022-05-19",30319],["2022-05-20",29201],["2022-05-21",29445],["2022-05-22",30294],["2022-05-23",29109],["2022-05-24",29655],["2022-05-25",29542],["2022-05-26",29201],["2022-05-27",28630],["2022-05-28",29031],["2022-05-29",29468],["2022-05-30",31734],["2022-05-31",31801],["2022-06-01",29806],["2022-06-02",30453],["2022-06-03",29700],["2022-06-04",29864],["2022-06-05",29919],["2022-06-06",31373],["2022-06-07",31125],["2022-06-08",30205],["2022-06-09",30110],["2022-06-10",29092],["2022-06-11",28425],["2022-06-12",26575],["2022-06-13",22487],["2022-06-14",22136],["2022-06-15",22584],["2022-06-16",20401],["2022-06-17",20469],["2022-06-18",18971],["2022-06-19",20574],["2022-06-20",20574],["2022-06-21",20724],["2022-06-22",19988],["2022-06-23",21110],["2022-06-24",21238],["2022-06-25",21491],["2022-06-26",21038],["2022-06-27",20743],["2022-06-28",20281],["2022-06-29",20123],["2022-06-30",19942],["2022-07-01",19280],["2022-07-02",19253],["2022-07-03",19316],["2022-07-04",20237],["2022-07-05",20176],["2022-07-06",20565],["2022-07-07",21625],["2022-07-08",21595],["2022-07-09",21592],["2022-07-10",20862],["2022-07-11",19964],["2022-07-12",19329],["2022-07-13",20235],["2022-07-14",20589],["2022-07-15",20830],["2022-07-16",21196],["2022-07-17",20798],["2022-07-18",22433],["2022-07-19",23397],["2022-07-20",23223],["2022-07-21",23152],["2022-07-22",22685],["2022-07-23",22451],["2022-07-24",22580],["2022-07-25",21311],["2022-07-26",21255],["2022-07-27",22952],["2022-07-28",23843],["2022-07-29",23774],["2022-07-30",23644],["2022-07-31",23293],["2022-08-01",23268],["2022-08-02",22988],["2022-08-03",22818],["2022-08-04",22623],["2022-08-05",23312],["2022-08-06",22954],["2022-08-07",23174],["2022-08-08",23810],["2022-08-09",23150],["2022-08-10",23954],["2022-08-11",23934],["2022-08-12",24404],["2022-08-13",24441],["2022-08-14",24305],["2022-08-15",24095],["2022-08-16",23855],["2022-08-17",23343],["2022-08-18",23191],["2022-08-19",20834],["2022-08-20",21140],["2022-08-21",21516],["2022-08-22",21400],["2022-08-23",21529],["2022-08-24",21368],["2022-08-25",21559],["2022-08-26",20241],["2022-08-27",20038],["2022-08-28",19556],["2022-08-29",20286],["2022-08-30",19812],["2022-08-31",20050],["2022-09-01",20131],["2022-09-02",19952],["2022-09-03",19832],["2022-09-04",20000],["2022-09-05",19797],["2022-09-06",18791],["2022-09-07",19293],["2022-09-08",19320],["2022-09-09",21360],["2022-09-10",21648],["2022-09-11",21827],["2022-09-12",22396],["2022-09-13",20174],["2022-09-14",20227],["2022-09-15",19702],["2022-09-16",19803],["2022-09-17",20114],["2022-09-18",19416],["2022-09-19",19537],["2022-09-20",18875],["2022-09-21",18461],["2022-09-22",19402],["2022-09-23",19290],["2022-09-24",18920],["2022-09-25",18807],["2022-09-26",19228],["2022-09-27",19079],["2022-09-28",19413],["2022-09-29",19592],["2022-09-30",19423],["2022-10-01",19311],["2022-10-02",19057],["2022-10-03",19629],["2022-10-04",20338],["2022-10-05",20158],["2022-10-06",19961],["2022-10-07",19530],["2022-10-08",19418],["2022-10-09",19439],["2022-10-10",19132],["2022-10-11",19060],["2022-10-12",19156],["2022-10-13",19375],["2022-10-14",19177],["2022-10-15",19069],["2022-10-16",19263],["2022-10-17",19550],["2022-10-18",19327],["2022-10-19",19124],["2022-10-20",19042],["2022-10-21",19164],["2022-10-22",19204],["2022-10-23",19570],["2022-10-24",19330],["2022-10-25",20080],["2022-10-26",20772],["2022-10-27",20295],["2022-10-28",20592],["2022-10-29",20810],["2022-10-30",20627],["2022-10-31",20491],["2022-11-01",20484],["2022-11-02",20152],["2022-11-03",20208],["2022-11-04",21149],["2022-11-05",21299],["2022-11-06",20906],["2022-11-07",20591],["2022-11-08",18547],["2022-11-09",15923],["2022-11-10",17601],["2022-11-11",17070],["2022-11-12",16812],["2022-11-13",16330],["2022-11-14",16619],["2022-11-15",16901],["2022-11-16",16663],["2022-11-17",16693],["2022-11-18",16700],["2022-11-19",16701],["2022-11-20",16280],["2022-11-21",15781],["2022-11-22",16227],["2022-11-23",16603],["2022-11-24",16599],["2022-11-25",16522],["2022-11-26",16459],["2022-11-27",16429],["2022-11-28",16213],["2022-11-29",16443],["2022-11-30",17164],["2022-12-01",16977],["2022-12-02",17093],["2022-12-03",16885],["2022-12-04",17106],["2022-12-05",16966],["2022-12-06",17089],["2022-12-07",16837],["2022-12-08",17224],["2022-12-09",17129],["2022-12-10",17127],["2022-12-11",17085],["2022-12-12",17210],["2022-12-13",17775],["2022-12-14",17803],["2022-12-15",17356],["2022-12-16",16632],["2022-12-17",16777],["2022-12-18",16738],["2022-12-19",16439],["2022-12-20",16896],["2022-12-21",16825],["2022-12-22",16821],["2022-12-23",16778],["2022-12-24",16836],["2022-12-25",16832],["2022-12-26",16919],["2022-12-27",16706],["2022-12-28",16547],["2022-12-29",16633],["2022-12-30",16607],["2022-12-31",16542],["2023-01-01",16617],["2023-01-02",16673],["2023-01-03",16675],["2023-01-04",16850],["2023-01-05",16832],["2023-01-06",16951],["2023-01-07",16944],["2023-01-08",17128],["2023-01-09",17178],["2023-01-10",17441],["2023-01-11",17943],["2023-01-12",18847],["2023-01-13",19930],["2023-01-14",20955],["2023-01-15",20872],["2023-01-16",21186],["2023-01-17",21135],["2023-01-18",20677],["2023-01-19",21072],["2023-01-20",22667],["2023-01-21",22784],["2023-01-22",22708],["2023-01-23",22916],["2023-01-24",22633],["2023-01-25",23061],["2023-01-26",23010],["2023-01-27",23074],["2023-01-28",23023],["2023-01-29",23742],["2023-01-30",22826],["2023-01-31",23125],["2023-02-01",23733],["2023-02-02",23489],["2023-02-03",23432],["2023-02-04",23327],["2023-02-05",22933],["2023-02-06",22763],["2023-02-07",23240],["2023-02-08",22963],["2023-02-09",21796],["2023-02-10",21625],["2023-02-11",21863],["2023-02-12",21784],["2023-02-13",21774],["2023-02-14",22200],["2023-02-15",24324],["2023-02-16",23518],["2023-02-17",24570],["2023-02-18",24632],["2023-02-19",24272],["2023-02-20",24842],["2023-02-21",24452],["2023-02-22",24182],["2023-02-23",23940],["2023-02-24",23185],["2023-02-25",23157],["2023-02-26",23555],["2023-02-27",23492],["2023-02-28",23142],["2023-03-01",23629],["2023-03-02",23465],["2023-03-03",22354],["2023-03-04",22347],["2023-03-05",22430],["2023-03-06",22410],["2023-03-07",22198],["2023-03-08",21705],["2023-03-09",20362],["2023-03-10",20151],["2023-03-11",20456],["2023-03-12",21997],["2023-03-13",24113],["2023-03-14",24670],["2023-03-15",24286],["2023-03-16",24999],["2023-03-17",27395],["2023-03-18",26907],["2023-03-19",27973],["2023-03-20",27717],["2023-03-21",28105],["2023-03-22",27251],["2023-03-23",28295],["2023-03-24",27454],["2023-03-25",27463],["2023-03-26",27968],["2023-03-27",27125],["2023-03-28",27261],["2023-03-29",28349],["2023-03-30",28029],["2023-03-31",28465],["2023-04-01",28453],["2023-04-02",28172],["2023-04-03",27800],["2023-04-04",28165],["2023-04-05",28170],["2023-04-06",28034],["2023-04-07",27906],["2023-04-08",27938],["2023-04-09",28324],["2023-04-10",29637],["2023-04-11",30200],["2023-04-12",29888],["2023-04-13",30374],["2023-04-14",30467],["2023-04-15",30295],["2023-04-16",30305],["2023-04-17",29430],["2023-04-18",30380],["2023-04-19",28797],["2023-04-20",28244],["2023-04-21",27263],["2023-04-22",27817],["2023-04-23",27591],["2023-04-24",27511],["2023-04-25",28301],["2023-04-26",28415],["2023-04-27",29473],["2023-04-28",29312],["2023-04-29",29230],["2023-04-30",29233],["2023-05-01",28068],["2023-05-02",28670],["2023-05-03",29026],["2023-05-04",28838],["2023-05-05",29506],["2023-05-06",28848],["2023-05-07",28430],["2023-05-08",27669],["2023-05-09",27628],["2023-05-10",27599],["2023-05-11",26969],["2023-05-12",26795],["2023-05-13",26775],["2023-05-14",26918],["2023-05-15",27162],["2023-05-16",27034],["2023-05-17",27406],["2023-05-18",26821],["2023-05-19",26880],["2023-05-20",27102],["2023-05-21",26748],["2023-05-22",26849],["2023-05-23",27220],["2023-05-24",26329],["2023-05-25",26474],["2023-05-26",26706],["2023-05-27",26854],["2023-05-28",28065],["2023-05-29",27736],["2023-05-30",27694],["2023-05-31",27210],["2023-06-01",26818],["2023-06-02",27243],["2023-06-03",27069],["2023-06-04",27115],["2023-06-05",25728],["2023-06-06",27230],["2023-06-07",26339],["2023-06-08",26499],["2023-06-09",26478],["2023-06-10",25841],["2023-06-11",25926],["2023-06-12",25905],["2023-06-13",25934],["2023-06-14",25129],["2023-06-15",25598],["2023-06-16",26345],["2023-06-17",26517],["2023-06-18",26340],["2023-06-19",26844],["2023-06-20",28308],["2023-06-21",29994],["2023-06-22",29885],["2023-06-23",30688],["2023-06-24",30527],["2023-06-25",30463],["2023-06-26",30268],["2023-06-27",30692],["2023-06-28",30077],["2023-06-29",30447],["2023-06-30",30472],["2023-07-01",30586],["2023-07-02",30617],["2023-07-03",31156],["2023-07-04",30767],["2023-07-05",30505],["2023-07-06",29895],["2023-07-07",30345],["2023-07-08",30285],["2023-07-09",30161],["2023-07-10",30412],["2023-07-11",30622],["2023-07-12",30380],["2023-07-13",31454],["2023-07-14",30312],["2023-07-15",30290],["2023-07-16",30232],["2023-07-17",30138],["2023-07-18",29859],["2023-07-19",29909],["2023-07-20",29800],["2023-07-21",29902],["2023-07-22",29794],["2023-07-23",30084],["2023-07-24",29176],["2023-07-25",29229],["2023-07-26",29352],["2023-07-27",29223],["2023-07-28",29314],["2023-07-29",29353],["2023-07-30",29281],["2023-07-31",29232],["2023-08-01",29706],["2023-08-02",29186],["2023-08-03",29194],["2023-08-04",29114],["2023-08-05",29072],["2023-08-06",29088],["2023-08-07",29211],["2023-08-08",29770],["2023-08-09",29582],["2023-08-10",29456],["2023-08-11",29426],["2023-08-12",29430],["2023-08-13",29304],["2023-08-14",29431],["2023-08-15",29200],["2023-08-16",28731],["2023-08-17",26623],["2023-08-18",26054],["2023-08-19",26100],["2023-08-20",26190],["2023-08-21",26127],["2023-08-22",26056],["2023-08-23",26433],["2023-08-24",26180],["2023-08-25",26060],["2023-08-26",26017],["2023-08-27",26102],["2023-08-28",26120],["2023-08-29",27716],["2023-08-30",27300],["2023-08-31",25941],["2023-09-01",25805],["2023-09-02",25870],["2023-09-03",25971],["2023-09-04",25826],["2023-09-05",25792],["2023-09-06",25760],["2023-09-07",26255],["2023-09-08",25910],["2023-09-09",25902],["2023-09-10",25842],["2023-09-11",25163],["2023-09-12",25840],["2023-09-13",26222],["2023-09-14",26523],["2023-09-15",26600],["2023-09-16",26560],["2023-09-17",26528],["2023-09-18",26763],["2023-09-19",27210],["2023-09-20",27125],["2023-09-21",26568],["2023-09-22",26580],["2023-09-23",26576],["2023-09-24",26248],["2023-09-25",26305],["2023-09-26",26222],["2023-09-27",26373],["2023-09-28",27021],["2023-09-29",26907],["2023-09-30",26963],["2023-10-01",27993],["2023-10-02",27495],["2023-10-03",27426],["2023-10-04",27779],["2023-10-05",27410],["2023-10-06",27931],["2023-10-07",27957],["2023-10-08",27917],["2023-10-09",27590],["2023-10-10",27390],["2023-10-11",26876],["2023-10-12",26760],["2023-10-13",26862],["2023-10-14",26852],["2023-10-15",27154],["2023-10-16",28501],["2023-10-17",28396],["2023-10-18",28320],["2023-10-19",28714],["2023-10-20",29669],["2023-10-21",29910],["2023-10-22",29992],["2023-10-23",33070],["2023-10-24",33923],["2023-10-25",34496],["2023-10-26",34152],["2023-10-27",33892],["2023-10-28",34081],["2023-10-29",34526],["2023-10-30",34475],["2023-10-31",34640],["2023-11-01",35421],["2023-11-02",34942],["2023-11-03",34717],["2023-11-04",35062],["2023-11-05",35012],["2023-11-06",35046],["2023-11-07",35399],["2023-11-08",35625],["2023-11-09",36701],["2023-11-10",37302],["2023-11-11",37130],["2023-11-12",37064],["2023-11-13",36463],["2023-11-14",35551],["2023-11-15",37858],["2023-11-16",36164],["2023-11-17",36614],["2023-11-18",36568],["2023-11-19",37360],["2023-11-20",37449],["2023-11-21",35742],["2023-11-22",37408],["2023-11-23",37294],["2023-11-24",37714],["2023-11-25",37781],["2023-11-26",37447],["2023-11-27",37243],["2023-11-28",37819],["2023-11-29",37855],["2023-11-30",37724],["2023-12-01",38683],["2023-12-02",39450],["2023-12-03",39972],["2023-12-04",41991],["2023-12-05",44073],["2023-12-06",43763],["2023-12-07",43273],["2023-12-08",44171],["2023-12-09",43714],["2023-12-10",43790],["2023-12-11",41253],["2023-12-12",41492],["2023-12-13",42869],["2023-12-14",43022],["2023-12-15",41940],["2023-12-16",42278],["2023-12-17",41375],["2023-12-18",42658],["2023-12-19",42276],["2023-12-20",43669],["2023-12-21",43862],["2023-12-22",43969],["2023-12-23",43702],["2023-12-24",42992],["2023-12-25",43576],["2023-12-26",42509],["2023-12-27",43429],["2023-12-28",42564],["2023-12-29",42067],["2023-12-30",42140],["2023-12-31",42284],["2024-01-01",44180],["2024-01-02",44947],["2024-01-03",42845],["2024-01-04",44151],["2024-01-05",44145],["2024-01-06",43968],["2024-01-07",43929],["2024-01-08",46951],["2024-01-09",46110],["2024-01-10",46654],["2024-01-11",46339],["2024-01-12",42783],["2024-01-13",42848],["2024-01-14",41732],["2024-01-15",42511],["2024-01-16",43138],["2024-01-17",42776],["2024-01-18",41328],["2024-01-19",41659],["2024-01-20",41696],["2024-01-21",41580],["2024-01-22",39568],["2024-01-23",39898],["2024-01-24",40085],["2024-01-25",39961],["2024-01-26",41824],["2024-01-27",42121],["2024-01-28",42031],["2024-01-29",43303],["2024-01-30",42941],["2024-01-31",42580],["2024-02-01",43083],["2024-02-02",43200],["2024-02-03",43011],["2024-02-04",42583],["2024-02-05",42709],["2024-02-06",43099],["2024-02-07",44350],["2024-02-08",45289],["2024-02-09",47133],["2024-02-10",47751],["2024-02-11",48300],["2024-02-12",49917],["2024-02-13",49700],["2024-02-14",51795],["2024-02-15",51880],["2024-02-16",52124],["2024-02-17",51643],["2024-02-18",52138],["2024-02-19",51775],["2024-02-20",52259],["2024-02-21",51849],["2024-02-22",51288],["2024-02-23",50744],["2024-02-24",51568],["2024-02-25",51729],["2024-02-26",54476],["2024-02-27",57037],["2024-02-28",62432],["2024-02-29",61131],["2024-03-01",62388],["2024-03-02",61987],["2024-03-03",63114],["2024-03-04",68246],["2024-03-05",63724],["2024-03-06",66074],["2024-03-07",66823],["2024-03-08",68124],["2024-03-09",68313],["2024-03-10",68956],["2024-03-11",72078],["2024-03-12",71452],["2024-03-13",73072],["2024-03-14",71389],["2024-03-15",69500],["2024-03-16",65301],["2024-03-17",68393],["2024-03-18",67610],["2024-03-19",61937],["2024-03-20",67841],["2024-03-21",65501],["2024-03-22",63797],["2024-03-23",63990],["2024-03-24",67210],["2024-03-25",69880],["2024-03-26",69988],["2024-03-27",69470],["2024-03-28",70781],["2024-03-29",69851],["2024-03-30",69582],["2024-03-31",71280],["2024-04-01",69650],["2024-04-02",65464],["2024-04-03",65963],["2024-04-04",68488],["2024-04-05",67821],["2024-04-06",68896],["2024-04-07",69360],["2024-04-08",71620],["2024-04-09",69146],["2024-04-10",70631],["2024-04-11",70006],["2024-04-12",67117],["2024-04-13",63925],["2024-04-14",65662],["2024-04-15",63420],["2024-04-16",63793],["2024-04-17",61277],["2024-04-18",63470],["2024-04-19",63818],["2024-04-20",64941],["2024-04-21",64941],["2024-04-22",66819],["2024-04-23",66414],["2024-04-24",64290],["2024-04-25",64498],["2024-04-26",63770],["2024-04-27",63462],["2024-04-28",63119],["2024-04-29",63866],["2024-04-30",60672],["2024-05-01",58365],["2024-05-02",59061],["2024-05-03",62882],["2024-05-04",63892],["2024-05-05",64012],["2024-05-06",63165],["2024-05-07",62312],["2024-05-08",61193],["2024-05-09",63074],["2024-05-10",60800],["2024-05-11",60826],["2024-05-12",61484],["2024-05-13",62940],["2024-05-14",61577],["2024-05-15",66206],["2024-05-16",65235],["2024-05-17",67024],["2024-05-18",66915],["2024-05-19",66274],["2024-05-20",71447],["2024-05-21",70148],["2024-05-22",69167],["2024-05-23",67970],["2024-05-24",68550],["2024-05-25",69291],["2024-05-26",68508],["2024-05-27",69436],["2024-05-28",68398],["2024-05-29",67652],["2024-05-30",68352],["2024-05-31",67540],["2024-06-01",67767],["2024-06-02",67766],["2024-06-03",68810],["2024-06-04",70538],["2024-06-05",71108],["2024-06-06",70799],["2024-06-07",69356],["2024-06-08",69310],["2024-06-09",69648],["2024-06-10",69540],["2024-06-11",67314],["2024-06-12",68264],["2024-06-13",66773],["2024-06-14",66044],["2024-06-15",66228],["2024-06-16",66677],["2024-06-17",66504],["2024-06-18",65175],["2024-06-19",64974],["2024-06-20",64870],["2024-06-21",64144],["2024-06-22",64262],["2024-06-23",63210],["2024-06-24",60293],["2024-06-25",61806],["2024-06-26",60865],["2024-06-27",61706],["2024-06-28",60428],["2024-06-29",60987],["2024-06-30",62772],["2024-07-01",62900],["2024-07-02",62135],["2024-07-03",60209],["2024-07-04",57050],["2024-07-05",56629],["2024-07-06",58230],["2024-07-07",55858],["2024-07-08",56715],["2024-07-09",58050],["2024-07-10",57726],["2024-07-11",57340],["2024-07-12",57889],["2024-07-13",59204],["2024-07-14",60798],["2024-07-15",64724],["2024-07-16",65044],["2024-07-17",64088],["2024-07-18",63988],["2024-07-19",66660],["2024-07-20",67140],["2024-07-21",68165],["2024-07-22",67532],["2024-07-23",65936],["2024-07-24",65376],["2024-07-25",65800],["2024-07-26",67908],["2024-07-27",67896],["2024-07-28",68250],["2024-07-29",66785],["2024-07-30",66188],["2024-07-31",64628],["2024-08-01",65354],["2024-08-02",61498],["2024-08-03",60698],["2024-08-04",58161],["2024-08-05",54019],["2024-08-06",56022],["2024-08-07",55134],["2024-08-08",61686],["2024-08-09",60838],["2024-08-10",60924],["2024-08-11",58713],["2024-08-12",59347],["2024-08-13",60587],["2024-08-14",58683],["2024-08-15",57541],["2024-08-16",58875],["2024-08-17",59492],["2024-08-18",58427],["2024-08-19",59438],["2024-08-20",59014],["2024-08-21",61156],["2024-08-22",60376],["2024-08-23",64037],["2024-08-24",64157],["2024-08-25",64220],["2024-08-26",62834],["2024-08-27",59415],["2024-08-28",59035],["2024-08-29",59359],["2024-08-30",59124],["2024-08-31",58974],["2024-09-01",57302],["2024-09-02",59132],["2024-09-03",57488],["2024-09-04",57971],["2024-09-05",56180],["2024-09-06",53963],["2024-09-07",54161],["2024-09-08",54870],["2024-09-09",57042],["2024-09-10",57636],["2024-09-11",57338],["2024-09-12",58132],["2024-09-13",60498],["2024-09-14",59993],["2024-09-15",59132],["2024-09-16",58214],["2024-09-17",60314],["2024-09-18",61760],["2024-09-19",62948],["2024-09-20",63201],["2024-09-21",63349],["2024-09-22",63579],["2024-09-23",63340],["2024-09-24",64263],["2024-09-25",63152],["2024-09-26",65174],["2024-09-27",65770],["2024-09-28",65858],["2024-09-29",65602],["2024-09-30",63328],["2024-10-01",60806],["2024-10-02",60649],["2024-10-03",60753],["2024-10-04",62086],["2024-10-05",62058],["2024-10-06",62820],["2024-10-07",62224],["2024-10-08",62160],["2024-10-09",60636],["2024-10-10",60326],["2024-10-11",62540],["2024-10-12",63206],["2024-10-13",62870],["2024-10-14",66084],["2024-10-15",67074],["2024-10-16",67620],["2024-10-17",67422],["2024-10-18",68428],["2024-10-19",68378],["2024-10-20",69032],["2024-10-21",67378],["2024-10-22",67426],["2024-10-23",66669],["2024-10-24",68198],["2024-10-25",66698],["2024-10-26",67093],["2024-10-27",68022],["2024-10-28",69962],["2024-10-29",72736],["2024-10-30",72345],["2024-10-31",70292],["2024-11-01",69496],["2024-11-02",69375],["2024-11-03",68776],["2024-11-04",67850],["2024-11-05",69372],["2024-11-06",75572],["2024-11-07",75858],["2024-11-08",76510],["2024-11-09",76677],["2024-11-10",80370],["2024-11-11",88648],["2024-11-12",87952],["2024-11-13",90375],["2024-11-14",87326],["2024-11-15",91032],["2024-11-16",90587],["2024-11-17",89856],["2024-11-18",90464],["2024-11-19",92311],["2024-11-20",94287],["2024-11-21",98317],["2024-11-22",98892],["2024-11-23",97672],["2024-11-24",97900],["2024-11-25",93010],["2024-11-26",91965],["2024-11-27",95863],["2024-11-28",95644],["2024-11-29",97460],["2024-11-30",96408],["2024-12-01",97185],["2024-12-02",95841],["2024-12-03",95850],["2024-12-04",98587],["2024-12-05",96946],["2024-12-06",99741],["2024-12-07",99832],["2024-12-08",101110],["2024-12-09",97276],["2024-12-10",96593],["2024-12-11",101125],["2024-12-12",100004],["2024-12-13",101424],["2024-12-14",101420],["2024-12-15",104464],["2024-12-16",106059],["2024-12-17",106134],["2024-12-18",100204],["2024-12-19",97462],["2024-12-20",97805],["2024-12-21",97292],["2024-12-22",95186],["2024-12-23",94881],["2024-12-24",98664],["2024-12-25",99430],["2024-12-26",95792],["2024-12-27",94299],["2024-12-28",95300],["2024-12-29",93738],["2024-12-30",92792],["2024-12-31",93576],["2025-01-01",94592],["2025-01-02",96985],["2025-01-03",98174],["2025-01-04",98220],["2025-01-05",98364],["2025-01-06",102236],["2025-01-07",96955],["2025-01-08",95061],["2025-01-09",92552],["2025-01-10",94726],["2025-01-11",94600],["2025-01-12",94545],["2025-01-13",94536],["2025-01-14",96561],["2025-01-15",100497],["2025-01-16",99987],["2025-01-17",104077],["2025-01-18",104556],["2025-01-19",101332],["2025-01-20",102260],["2025-01-21",106144],["2025-01-22",103707],["2025-01-23",103910],["2025-01-24",104870],["2025-01-25",104747],["2025-01-26",102620],["2025-01-27",102083],["2025-01-28",101336],["2025-01-29",103733],["2025-01-30",104723],["2025-01-31",102430],["2025-02-01",100636],["2025-02-02",97701],["2025-02-03",101329],["2025-02-04",97763],["2025-02-05",96612],["2025-02-06",96554],["2025-02-07",96507],["2025-02-08",96445],["2025-02-09",96463],["2025-02-10",97431],["2025-02-11",95778],["2025-02-12",97870],["2025-02-13",96608],["2025-02-14",97500],["2025-02-15",97570],["2025-02-16",96118],["2025-02-17",95780],["2025-02-18",95672],["2025-02-19",96644],["2025-02-20",98305],["2025-02-21",96182],["2025-02-22",96551],["2025-02-23",96258],["2025-02-24",91553],["2025-02-25",88680],["2025-02-26",84250],["2025-02-27",84709],["2025-02-28",84350],["2025-03-01",86065],["2025-03-02",94270],["2025-03-03",86221],["2025-03-04",87282],["2025-03-05",90606],["2025-03-06",89932],["2025-03-07",86802],["2025-03-08",86222],["2025-03-09",80734],["2025-03-10",78596],["2025-03-11",82933],["2025-03-12",83680],["2025-03-13",81116],["2025-03-14",83983],["2025-03-15",84338],["2025-03-16",82575],["2025-03-17",84010],["2025-03-18",82715],["2025-03-19",86846],["2025-03-20",84223],["2025-03-21",84089],["2025-03-22",83841],["2025-03-23",86082],["2025-03-24",87498],["2025-03-25",87393],["2025-03-26",86909],["2025-03-27",87232],["2025-03-28",84424],["2025-03-29",82649],["2025-03-30",82390],["2025-03-31",82550],["2025-04-01",85158],["2025-04-02",82516],["2025-04-03",83213],["2025-04-04",83890],["2025-04-05",83538],["2025-04-06",78430],["2025-04-07",79163],["2025-04-08",76322],["2025-04-09",82615],["2025-04-10",79607],["2025-04-11",83424],["2025-04-12",85277],["2025-04-13",83760],["2025-04-14",84592],["2025-04-15",83644],["2025-04-16",84030],["2025-04-17",84948],["2025-04-18",84475],["2025-04-19",85077],["2025-04-20",85179],["2025-04-21",87516],["2025-04-22",93443],["2025-04-23",93691],["2025-04-24",93980],["2025-04-25",94639],["2025-04-26",94628],["2025-04-27",93749],["2025-04-28",95011],["2025-04-29",94257],["2025-04-30",94172],["2025-05-01",96490],["2025-05-02",96887],["2025-05-03",95856],["2025-05-04",94278],["2025-05-05",94734],["2025-05-06",96834],["2025-05-07",97030],["2025-05-08",103262],["2025-05-09",102972],["2025-05-10",104810],["2025-05-11",104118],["2025-05-12",102791],["2025-05-13",104104],["2025-05-14",103508],["2025-05-15",103764],["2025-05-16",103464],["2025-05-17",103127],["2025-05-18",106454],["2025-05-19",105574],["2025-05-20",106850],["2025-05-21",109644],["2025-05-22",111696],["2025-05-23",107318],["2025-05-24",107762],["2025-05-25",109004],["2025-05-26",109435],["2025-05-27",108938],["2025-05-28",107782],["2025-05-29",105590],["2025-05-30",103985],["2025-05-31",104592],["2025-06-01",105643],["2025-06-02",105858],["2025-06-03",105377],["2025-06-04",104697],["2025-06-05",101509],["2025-06-06",104288],["2025-06-07",105552],["2025-06-08",105734],["2025-06-09",110263],["2025-06-10",110274],["2025-06-11",108645],["2025-06-12",105672],["2025-06-13",106067],["2025-06-14",105415],["2025-06-15",105594],["2025-06-16",106795],["2025-06-17",104551],["2025-06-18",104887],["2025-06-19",104659],["2025-06-20",103298],["2025-06-21",102120],["2025-06-22",100964],["2025-06-23",105334],["2025-06-24",106083],["2025-06-25",107341],["2025-06-26",106947],["2025-06-27",107048],["2025-06-28",107297],["2025-06-29",108357],["2025-06-30",107146],["2025-07-01",105681],["2025-07-02",108850],["2025-07-03",109585],["2025-07-04",107984],["2025-07-05",108198],["2025-07-06",109204],["2025-07-07",108263],["2025-07-08",108923],["2025-07-09",111234],["2025-07-10",116010],["2025-07-11",117528],["2025-07-12",117420],["2025-07-13",119087],["2025-07-14",119841],["2025-07-15",117758],["2025-07-16",118630],["2025-07-17",119178],["2025-07-18",117925],["2025-07-19",117840],["2025-07-20",117265],["2025-07-21",117380],["2025-07-22",119954],["2025-07-23",118756],["2025-07-24",118341],["2025-07-25",117614],["2025-07-26",117920],["2025-07-27",119416],["2025-07-28",118062],["2025-07-29",117951],["2025-07-30",117840],["2025-07-31",115764],["2025-08-01",113298],["2025-08-02",112546],["2025-08-03",114209],["2025-08-04",115055],["2025-08-05",114130],["2025-08-06",114992],["2025-08-07",117472],["2025-08-08",116675],["2025-08-09",116462],["2025-08-10",119294],["2025-08-11",118686],["2025-08-12",120134],["2025-08-13",123306],["2025-08-14",118295],["2025-08-15",117342],["2025-08-16",117381],["2025-08-17",117405],["2025-08-18",116227],["2025-08-19",112873],["2025-08-20",114271],["2025-08-21",112500],["2025-08-22",116936],["2025-08-23",115438],["2025-08-24",113494],["2025-08-25",110112],["2025-08-26",111763],["2025-08-27",111262],["2025-08-28",112567],["2025-08-29",108377],["2025-08-30",108816],["2025-08-31",108246],["2025-09-01",109237],["2025-09-02",111240],["2025-09-03",111706],["2025-09-04",110731],["2025-09-05",110660],["2025-09-06",110188],["2025-09-07",111137],["2025-09-08",112065],["2025-09-09",111546],["2025-09-10",113960],["2025-09-11",115483],["2025-09-12",116029],["2025-09-13",115918],["2025-09-14",115268],["2025-09-15",115350],["2025-09-16",116789],["2025-09-17",116448],["2025-09-18",117074],["2025-09-19",115632],["2025-09-20",115686],["2025-09-21",115232],["2025-09-22",112651],["2025-09-23",111999],["2025-09-24",113307],["2025-09-25",108994],["2025-09-26",109643],["2025-09-27",109636],["2025-09-28",112164],["2025-09-29",114312],["2025-09-30",114049],["2025-10-01",118595],["2025-10-02",120529],["2025-10-03",122232],["2025-10-04",122391],["2025-10-05",123482],["2025-10-06",124659],["2025-10-07",121333],["2025-10-08",123306],["2025-10-09",121662],["2025-10-10",112774],["2025-10-11",110644],["2025-10-12",114959],["2025-10-13",115166],["2025-10-14",113028],["2025-10-15",110763],["2025-10-16",108194],["2025-10-17",106432],["2025-10-18",107185],["2025-10-19",108643],["2025-10-20",110532],["2025-10-21",108298],["2025-10-22",107567],["2025-10-23",110078],["2025-10-24",111005],["2025-10-25",111646],["2025-10-26",114559],["2025-10-27",114108],["2025-10-28",112898],["2025-10-29",110021],["2025-10-30",108323],["2025-10-31",109608],["2025-11-01",110098],["2025-11-02",110541],["2025-11-03",106583],["2025-11-04",101497],["2025-11-05",103885],["2025-11-06",101346],["2025-11-07",103339],["2025-11-08",102313],["2025-11-09",104723],["2025-11-10",106011],["2025-11-11",103059],["2025-11-12",101654],["2025-11-13",99692],["2025-11-14",94594],["2025-11-15",95596],["2025-11-16",94261],["2025-11-17",92215],["2025-11-18",92961],["2025-11-19",91555],["2025-11-20",86637],["2025-11-21",85129],["2025-11-22",84740],["2025-11-23",86830],["2025-11-24",88300],["2025-11-25",87370],["2025-11-26",90484],["2025-11-27",91334],["2025-11-28",90891],["2025-11-29",90802],["2025-11-30",90360],["2025-12-01",86286],["2025-12-02",91278],["2025-12-03",93430],["2025-12-04",92078],["2025-12-05",89330],["2025-12-06",89237],["2025-12-07",90395],["2025-12-08",90634],["2025-12-09",92679],["2025-12-10",92015],["2025-12-11",92513],["2025-12-12",90268],["2025-12-13",90240],["2025-12-14",88172],["2025-12-15",86432],["2025-12-16",87863],["2025-12-17",86243],["2025-12-18",85516],["2025-12-19",88137],["2025-12-20",88361],["2025-12-21",88659],["2025-12-22",88621],["2025-12-23",87486],["2025-12-24",87669],["2025-12-25",87225],["2025-12-26",87370],["2025-12-27",87877],["2025-12-28",87953],["2025-12-29",87237],["2025-12-30",88485],["2025-12-31",87648],["2026-01-01",88839],["2026-01-02",89995],["2026-01-03",90628],["2026-01-04",91530],["2026-01-05",93860],["2026-01-06",93748],["2026-01-07",91364],["2026-01-08",91100],["2026-01-09",90641],["2026-01-10",90505],["2026-01-11",91014],["2026-01-12",91296],["2026-01-13",95414],["2026-01-14",96952],["2026-01-15",95605],["2026-01-16",95551],["2026-01-17",95148],["2026-01-18",93673],["2026-01-19",92631],["2026-01-20",88428],["2026-01-21",89455],["2026-01-22",89560],["2026-01-23",89600],["2026-01-24",89225],["2026-01-25",86670],["2026-01-26",88347],["2026-01-27",89250],["2026-01-28",89300],["2026-01-29",84650],["2026-01-30",84260],["2026-01-31",78741],["2026-02-01",76968],["2026-02-02",78739],["2026-02-03",75770],["2026-02-04",73166],["2026-02-05",62910],["2026-02-06",70580],["2026-02-07",69289],["2026-02-08",70330],["2026-02-09",70138],["2026-02-10",68841],["2026-02-11",67083],["2026-02-12",66272],["2026-02-13",68854],["2026-02-14",69823],["2026-02-15",68833],["2026-02-16",68892],["2026-02-17",67504],["2026-02-18",66461],["2026-02-19",67004],["2026-02-20",68020],["2026-02-21",67976],["2026-02-22",67643],["2026-02-23",64656],["2026-02-24",64058],["2026-02-25",67988],["2026-02-26",67485],["2026-02-27",65872],["2026-02-28",66973],["2026-03-01",65776],["2026-03-02",68830],["2026-03-03",68338],["2026-03-04",72667],["2026-03-05",70891],["2026-03-06",68114],["2026-03-07",67263],["2026-03-08",65971],["2026-03-09",68432],["2026-03-10",69949],["2026-03-11",70192],["2026-03-12",70541],["2026-03-13",70930],["2026-03-14",71212],["2026-03-15",72815],["2026-03-16",74885],["2026-03-17",73909],["2026-03-18",71247],["2026-03-19",69930],["2026-03-20",70511],["2026-03-21",68918],["2026-03-22",67859],["2026-03-23",70906],["2026-03-24",70557],["2026-03-25",71337],["2026-03-26",68820],["2026-03-27",66407],["2026-03-28",66377],["2026-03-29",66011],["2026-03-30",66797],["2026-03-31",68284],["2026-04-01",68114],["2026-04-02",66902],["2026-04-03",66964],["2026-04-04",67300],["2026-04-05",69034],["2026-04-06",68854],["2026-04-07",71924],["2026-04-08",71070],["2026-04-09",71788],["2026-04-10",72963],["2026-04-11",73043],["2026-04-12",70741],["2026-04-13",74418],["2026-04-14",74132],["2026-04-15",74810],["2026-04-16",75154],["2026-04-17",77072],["2026-04-18",75692],["2026-04-19",73802],["2026-04-20",75841],["2026-04-21",76336],["2026-04-22",78178],["2026-04-23",78257],["2026-04-24",77437],["2026-04-25",77625],["2026-04-26",78658],["2026-04-27",77371],["2026-04-28",76343],["2026-04-29",75780],["2026-04-30",76347],["2026-05-01",78231],["2026-05-02",78687],["2026-05-03",78569],["2026-05-04",79861],["2026-05-05",80906],["2026-05-06",81447],["2026-05-07",80006],["2026-05-08",80193],["2026-05-09",80678],["2026-05-10",82210],["2026-05-11",81746],["2026-05-12",80504],["2026-05-13",79314],["2026-05-14",81090],["2026-05-15",79113],["2026-05-16",78148],["2026-05-17",77458],["2026-05-18",77002],["2026-05-19",76834],["2026-05-20",77552],["2026-05-21",77616],["2026-05-22",75540],["2026-05-23",76752],["2026-05-24",77065],["2026-05-25",77322],["2026-05-26",75930],["2026-05-27",74449],["2026-05-28",73618],["2026-05-29",73461],["2026-05-30",73884],["2026-05-31",73674],["2026-06-01",71409],["2026-06-02",66761],["2026-06-03",64143],["2026-06-04",63886],["2026-06-05",61056],["2026-06-06",60885],["2026-06-07",63332],["2026-06-08",63086],["2026-06-09",61730],["2026-06-10",61511],["2026-06-11",63626],["2026-06-12",63580],["2026-06-13",64458],["2026-06-14",65746],["2026-06-15",66329],["2026-06-16",65675],["2026-06-17",64509],["2026-06-18",62958],["2026-06-19",63544],["2026-06-20",64298],["2026-06-21",63312],["2026-06-22",64020],["2026-06-23",62735],["2026-06-24",61078],["2026-06-25",59794],["2026-06-26",60097],["2026-06-27",60029],["2026-06-28",59577],["2026-06-29",60260],["2026-06-30",58625],["2026-07-01",60024],["2026-07-02",61560],["2026-07-03",62583],["2026-07-04",63144],["2026-07-05",63650],["2026-07-06",64042],["2026-07-07",63364],["2026-07-08",62290],["2026-07-09",63230],["2026-07-10",64162],["2026-07-11",63819],["2026-07-12",63780],["2026-07-13",62335],["2026-07-14",65044],["2026-07-15",64756],["2026-07-16",63830],["2026-07-17",63932],["2026-07-18",64834],["2026-07-19",64723],["2026-07-20",65256],["2026-07-21",66556],["2026-07-22",66114],["2026-07-23",65099],["2026-07-24",64140],["2026-07-25",64375],["2026-07-26",65400],["2026-07-27",63756],["2026-07-28",63915],["2026-07-29",63984],["2026-07-30",64780],["2026-07-31",62888],["2026-08-01",62824],["2026-08-02",63570],["2026-08-03",63520],["2026-08-04",64107],["2026-08-05",64665],["2026-08-06",64324],["2026-08-07",64923],["2026-08-08",64963],["2026-08-09",64902],["2026-08-10",63970],["2026-08-11",63600],["2026-08-12",63480],["2026-08-13",63491],["2026-08-14",63044],["2026-08-15",63086],["2026-08-16",62900],["2026-08-17",64532],["2026-08-18",64725],["2026-08-19",69335],["2026-08-20",73025],["2026-08-21",78338],["2026-08-22",77075],["2026-08-23",77734],["2026-08-24",78993],["2026-08-25",78539],["2026-08-26",79024],["2026-08-27",80250],["2026-08-28",77846],["2026-08-29",78230],["2026-08-30",77682],["2026-08-31",78581],["2026-09-01",77439],["2026-09-02",77340],["2026-09-03",81270],["2026-09-04",79661],["2026-09-05",79832],["2026-09-06",80342],["2026-09-07",79112],["2026-09-08",78456],["2026-09-09",78306],["2026-09-10",77154]];

(function(){
  const el = document.getElementById('wlChart');
  if (!el) return;

  const btcZeit = BTC_DAILY.map(d => new Date(d[0]+'T00:00:00').getTime());
  const btcPreis = BTC_DAILY.map(d => d[1]);
  const fullMinT = btcZeit[0], fullMaxT = btcZeit[btcZeit.length - 1];

  const btcMap = new Map(BTC_DAILY.map(d => [d[0], d[1]]));
  function btcPreisAm(dateStr){
    if (btcMap.has(dateStr)) return btcMap.get(dateStr);
    const t = new Date(dateStr+'T00:00:00').getTime();
    let beste = BTC_DAILY[0][1], bestAbstand = Infinity;
    for (const [ds,p] of btcMap){
      const a = Math.abs(new Date(ds+'T00:00:00').getTime() - t);
      if (a < bestAbstand){ bestAbstand = a; beste = p; }
    }
    return beste;
  }

  function niceStep(rough){
    const exp = Math.floor(Math.log10(rough));
    const f = rough / Math.pow(10, exp);
    const nf = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
    return nf * Math.pow(10, exp);
  }
  function preisLabel(v){
    return (v >= 1000 ? Math.round(v/1000) + 'k' : Math.round(v)) + ' $';
  }
  function wlDatumLabel(s){
    if (s.label && s.label.trim()) return s.label;
    return new Date(s.date+'T00:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'});
  }

  // Icon je Asset: bekannte Ticker als farbiges SVG-Logo (CDN, mit Fallback-Buchstaben-Icon
  // bei fehlendem Logo), damit gleiche Assets im Chart und in der Tabelle immer gleich aussehen.
  function assetIconHtml(asset){
    const ticker = String(asset || '').toLowerCase().replace(/[^a-z0-9]/g,'');
    const buchstabe = esc((asset || '?').trim().slice(0,3).toUpperCase());
    return '<span class="wl-icon">' +
      '<img src="https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/'+ticker+'.svg" alt="" ' +
        'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">' +
      '<span class="wl-icon-fallback" style="display:none">'+buchstabe+'</span>' +
    '</span>';
  }
  function statusOptionsHtml(aktuell){
    const a = aktuell || '';
    return ['', 'win', 'be_win', 'be_loss', 'lose', 'no_entry']
      .map(k => '<option value="'+k+'"'+(k===a?' selected':'')+'>'+WL_STATUS_HINT[k]+'</option>').join('');
  }
  function auswahlHtml(klasse, werte, aktuell){
    const a = aktuell || '';
    return '<select class="'+klasse+'">' +
      werte.map(([v,l]) => '<option value="'+v+'"'+(v===a?' selected':'')+'>'+l+'</option>').join('') +
    '</select>';
  }

  const B = 860, PADL = 54, PADR = 16, PADT = 18, PADB = 30, H = 340;
  const PLOTW = B - PADL - PADR, PLOTH = H - PADT - PADB;
  let domain = [fullMinT, fullMaxT];
  let signale = [];
  let sortSpalte = 'date', sortRichtung = 'desc';

  function render(){
    // Haeufungen: Signale innerhalb eines FENSTERS von max. 2 Tagen ab dem ersten Signal
    // der Gruppe. Bewusst kein Verketten (0->2->4->6 Tage waere sonst eine einzige Gruppe) -
    // sobald ein Signal mehr als 2 Tage nach dem Gruppenstart liegt, beginnt eine neue Gruppe.
    const sigSortiert = signale.slice().sort((a,b) => a.date.localeCompare(b.date));
    const CLUSTER_GRENZE = 2 * 86400000;
    const cluster = [];
    let aktuellCluster = null;
    sigSortiert.forEach(s => {
      const t = new Date(s.date+'T00:00:00').getTime();
      if (aktuellCluster && (t - aktuellCluster.minT) <= CLUSTER_GRENZE) {
        aktuellCluster.sigs.push(s); aktuellCluster.maxT = Math.max(aktuellCluster.maxT, t);
      } else {
        aktuellCluster = { sigs: [s], minT: t, maxT: t };
        cluster.push(aktuellCluster);
      }
    });
    const echteCluster = cluster.filter(c => c.sigs.length >= 2);
    const clusterVonSignal = new Map();
    echteCluster.forEach((c, ci) => c.sigs.forEach(s => clusterVonSignal.set(s, ci)));

    // Signale an EXAKT demselben Tag: eigene, staerkere Markierung (unabhaengig von der Haeufung)
    const proTag = {};
    signale.forEach(s => { proTag[s.date] = (proTag[s.date] || 0) + 1; });
    const gleicherTag = s => proTag[s.date] > 1 ? proTag[s.date] : 0;

    const [minT, maxT] = domain;
    const spanne = Math.max(maxT - minT, 1);
    const x = t => PADL + (t - minT) / spanne * PLOTW;
    const tVonX = px => minT + (px - PADL) / PLOTW * spanne;

    let i0 = btcZeit.findIndex(t => t >= minT); if (i0 < 0) i0 = 0; i0 = Math.max(0, i0 - 1);
    let i1 = btcZeit.length - 1; while (i1 > 0 && btcZeit[i1] > maxT) i1--; i1 = Math.min(btcZeit.length - 1, i1 + 1);
    const visZeit = btcZeit.slice(i0, i1 + 1), visPreis = btcPreis.slice(i0, i1 + 1);

    const minP = Math.min(...visPreis), maxP = Math.max(...visPreis);
    const logMin = Math.log(Math.max(minP * 0.9, 1)), logMax = Math.log(maxP * 1.1);
    const logSpanne = Math.max(logMax - logMin, 0.0001);
    const yPreis = p => PADT + PLOTH - (Math.log(p) - logMin) / logSpanne * PLOTH;

    const linie = visZeit.map((t,i) => (i===0?'M':'L') + x(t).toFixed(1) + ',' + yPreis(visPreis[i]).toFixed(1)).join(' ');
    const flaeche = linie + ' L' + x(visZeit[visZeit.length-1]).toFixed(1) + ',' + (H-PADB).toFixed(1) +
      ' L' + x(visZeit[0]).toFixed(1) + ',' + (H-PADB).toFixed(1) + ' Z';

    // Preis-Gitterlinien: "runde" Schritte, passen sich beim Reinzoomen automatisch an
    const rawStep = (maxP - minP) / 4 || maxP * 0.2;
    const step = niceStep(rawStep);
    const preisTicks = [];
    for (let v = Math.ceil(minP / step) * step; v <= maxP; v += step) preisTicks.push(v);
    const preisGitter = preisTicks.map(v => {
      const yt = yPreis(v);
      return '<line class="wl-grid" x1="'+PADL+'" y1="'+yt.toFixed(1)+'" x2="'+(B-PADR)+'" y2="'+yt.toFixed(1)+'"/>' +
        '<text class="wl-axis-label-y" x="'+(PADL-8)+'" y="'+(yt+3).toFixed(1)+'" text-anchor="end">'+preisLabel(v)+'</text>';
    }).join('');

    // Zeit-Gitter: je nach Zoomstufe Jahre, Monate oder einzelne Tage
    const spanTage = spanne / 86400000;
    let zeitTicks = [];
    if (spanTage > 540) {
      for (let j = new Date(minT).getFullYear(); j <= new Date(maxT).getFullYear(); j++) {
        const t = new Date(j, 0, 1).getTime();
        if (t >= minT && t <= maxT) zeitTicks.push({ t, label: String(j) });
      }
    } else if (spanTage > 50) {
      let cur = new Date(new Date(minT).getFullYear(), new Date(minT).getMonth(), 1);
      while (cur.getTime() <= maxT) {
        const t = cur.getTime();
        if (t >= minT) zeitTicks.push({ t, label: cur.toLocaleDateString('de-DE',{month:'short',year:'2-digit'}) });
        cur = new Date(cur.getFullYear(), cur.getMonth()+1, 1);
      }
    } else {
      const n = 6;
      for (let k = 0; k <= n; k++) {
        const t = minT + (k/n) * spanne;
        zeitTicks.push({ t, label: new Date(t).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}) });
      }
    }
    const zeitGitter = zeitTicks.map(tk => {
      const xt = x(tk.t);
      return '<line class="wl-grid-v" x1="'+xt.toFixed(1)+'" y1="'+PADT+'" x2="'+xt.toFixed(1)+'" y2="'+(H-PADB)+'"/>' +
        '<text class="wl-axis-label" x="'+xt.toFixed(1)+'" y="'+(H-10)+'">'+tk.label+'</text>';
    }).join('');

    // Cluster-Bänder (Signale mit <=2 Tagen Abstand) im sichtbaren Bereich
    const clusterBaender = echteCluster.map((c, ci) => {
      if (c.maxT < minT || c.minT > maxT) return '';
      const x0 = Math.max(x(c.minT) - 6, PADL), x1 = Math.min(x(c.maxT) + 6, B - PADR);
      if (x1 <= x0) return '';
      return '<rect class="wl-cluster-band '+(ci % 2 === 0 ? 'wl-band-a' : 'wl-band-b')+'" x="'+x0.toFixed(1)+'" y="'+PADT+'" width="'+(x1-x0).toFixed(1)+'" height="'+PLOTH+'" rx="4"/>';
    }).join('');

    // Signale im sichtbaren Zeitraum, nach Datum gruppiert (Stapel bei Mehrfach-Signalen am selben Tag)
    const sichtbar = signale.filter(s => {
      const t = new Date(s.date+'T00:00:00').getTime();
      return t >= minT - CLUSTER_GRENZE && t <= maxT + CLUSTER_GRENZE;
    });
    const nachDatum = {};
    sichtbar.forEach(s => { (nachDatum[s.date] = nachDatum[s.date] || []).push(s); });

    const marker = [];
    Object.keys(nachDatum).forEach(datum => {
      const gruppe = nachDatum[datum];
      const preis = btcPreisAm(datum);
      const cx0 = x(new Date(datum+'T00:00:00').getTime());
      const cy0 = yPreis(preis);
      gruppe.forEach((s, i) => {
        // Mehrere Signale am selben Tag werden UNTEREINANDER gestapelt (nicht nebeneinander),
        // damit die X-Position (= Datum) immer eindeutig bleibt.
        const dy = (i - (gruppe.length - 1) / 2) * 24;
        const cy = cy0 + dy;
        if (cx0 < PADL - 20 || cx0 > B - PADR + 20) return;
        const tagAnzahl = gleicherTag(s);
        const zusatz = tagAnzahl ? ' · '+tagAnzahl+'× am selben Tag' : (clusterVonSignal.has(s) ? ' · Teil einer Signal-Häufung' : '');
        const setup = wlSetupText(s);
        const titel = wlDatumLabel(s)+' · '+s.asset+' · '+(s.tf||'–')+' · '+WL_LABEL[wlStatus(s)]+
          (setup?' · '+setup:'')+(s.notiz?' · '+s.notiz:'')+' · BTC ≈ '+Math.round(preis).toLocaleString('de-DE')+' $'+zusatz;
        marker.push({ cx: cx0, cy, farbe: WL_FARBEN[wlStatus(s)], titel, asset: s.asset,
          geclustert: clusterVonSignal.has(s), selberTag: !!tagAnzahl,
          tradeId: s.tradeId || null, datum: datum });
      });
    });

    // Signale, die zu einem Trade gehoeren, im Chart mit einer Linie verbinden -
    // dann sieht man auf einen Blick, dass das ein Trade ueber mehrere Zeitpunkte ist.
    const nachTrade = {};
    marker.forEach(p => { if (p.tradeId) (nachTrade[p.tradeId] = nachTrade[p.tradeId] || []).push(p); });
    const tradeLinien = Object.keys(nachTrade).map(tid => {
      const gruppe = nachTrade[tid].slice().sort((a,b) => a.datum.localeCompare(b.datum) || a.cy - b.cy);
      if (gruppe.length < 2) return '';
      const d = gruppe.map((p,i) => (i===0?'M':'L') + p.cx.toFixed(1) + ',' + p.cy.toFixed(1)).join(' ');
      return '<path class="wl-trade-linie" d="'+d+'" stroke="'+wlTradeFarbe(tid)+'"/>';
    }).join('');

    const markerHtml = marker.map((p,i) =>
      '<span class="wl-marker'+(p.geclustert?' geclustert':'')+(p.selberTag?' selber-tag':'')+'" data-i="'+i+'" style="left:'+(p.cx/B*100).toFixed(2)+'%;top:'+(p.cy/H*100).toFixed(2)+'%;border-color:'+p.farbe+'">' +
        assetIconHtml(p.asset) +
      '</span>'
    ).join('');

    const zoomAktiv = domain[0] !== fullMinT || domain[1] !== fullMaxT;
    // Ergebnis-Zahlen zaehlen TRADES, nicht Signale: verbundene Signale (gleiche
    // Trade-ID) sind ein Trade. Weichen die Bewertungen innerhalb eines Trades ab,
    // zaehlt die des juengsten bewerteten Signals (= das Ergebnis am Ende).
    const trades = new Map();
    signale.slice().sort((a,b) => a.date.localeCompare(b.date)).forEach(s => {
      const k = wlTradeKey(s);
      if (!trades.has(k)) trades.set(k, { status: '' });
      if (s.status) trades.get(k).status = s.status;
    });
    const tradeStati = [...trades.values()].map(t => t.status);
    const anzTrades = trades.size;
    const anzWin = tradeStati.filter(x => x === 'win').length;
    const anzBeWin = tradeStati.filter(x => x === 'be_win').length;
    const anzBeLoss = tradeStati.filter(x => x === 'be_loss').length;
    const anzLose = tradeStati.filter(x => x === 'lose').length;
    const anzNoEntry = tradeStati.filter(x => x === 'no_entry').length;
    const assetsAnzahl = new Set(signale.map(s => s.asset)).size;

    const tabelleSortiert = signale.slice().sort((a,b) => {
      let cmp;
      if (sortSpalte === 'asset') cmp = a.asset.localeCompare(b.asset) || a.date.localeCompare(b.date);
      else cmp = a.date.localeCompare(b.date);
      return sortRichtung === 'asc' ? cmp : -cmp;
    });
    const tabelle = tabelleSortiert.map((s, idx) => {
      const grp = clusterVonSignal.has(s) ? clusterVonSignal.get(s) : null;
      const grpVorher = idx > 0 && clusterVonSignal.has(tabelleSortiert[idx-1]) ? clusterVonSignal.get(tabelleSortiert[idx-1]) : null;
      // Gruppen wechseln sich farblich ab und bekommen oben eine Trennlinie, damit zwei
      // direkt untereinanderstehende Haeufungen nicht wie eine einzige grosse aussehen.
      const klassen = [];
      if (grp !== null) {
        klassen.push('wl-row-cluster', grp % 2 === 0 ? 'wl-grp-a' : 'wl-grp-b');
        if (grp !== grpVorher) klassen.push('wl-grp-start');
      }
      const tagAnzahl = gleicherTag(s);
      const tagBadge = tagAnzahl ? ' <span class="wl-sameday">'+tagAnzahl+'× selber Tag</span>' : '';
      const st = wlStatus(s);
      const setup = wlSetupText(s);
      const tradeAttr = s.tradeId ? ' data-trade="'+esc(String(s.tradeId))+'"' : '';
      return '<tr class="'+klassen.join(' ')+'" data-id="'+s.id+'"'+tradeAttr+' title="Doppelklick für Details">' +
        '<td class="muted">'+esc(wlDatumLabel(s))+tagBadge+'</td>' +
        '<td class="wl-trade-cell">' +
          (s.tradeId
            ? '<span class="wl-trade-bar" style="background:'+wlTradeFarbe(s.tradeId)+'"></span>' +
              '<span class="wl-trade-chip" style="color:'+wlTradeFarbe(s.tradeId)+'">'+esc(s.tradeId)+'</span>'
            : '<span class="muted">–</span>') +
        '</td>' +
        '<td><span class="wl-table-asset">'+assetIconHtml(s.asset)+' '+esc(s.asset)+'</span></td>' +
        '<td class="muted">'+esc(s.tf||'–')+'</td>' +
        '<td class="muted">'+(setup ? esc(setup) : '–')+'</td>' +
        '<td class="muted">'+WL_PHASE_LABEL[s.marktphase || '']+'</td>' +
        '<td class="muted">'+
          ([s.pattern ? WL_PATTERN_LABEL[s.pattern] : '', s.candles ? WL_CANDLE_LABEL[s.candles] : '']
            .filter(Boolean).join(' · ') || '–') +
        '</td>' +
        '<td class="muted">'+
          ((s.divLokal || s.divStruktur)
            ? 'L: '+WL_DIV_KURZ[s.divLokal || '']+' · S: '+WL_DIV_KURZ[s.divStruktur || '']
            : '–') +
        '</td>' +
        '<td>'+(s.note ? '<span class="wl-note" style="border-color:'+WL_NOTE_FARBEN[s.note]+';color:'+WL_NOTE_FARBEN[s.note]+'">'+esc(s.note)+'</span>' : '<span class="muted">–</span>')+'</td>' +
        '<td><span class="badge" style="background:transparent;border:1.5px solid '+WL_FARBEN[st]+';color:'+WL_FARBEN[st]+'">'+WL_LABEL[st]+'</span></td>' +
        '<td class="muted">'+esc(s.notiz||'–')+'</td>' +
        '<td class="wl-row-actions"><button type="button" class="wl-edit" title="Details">✎</button><button type="button" class="wl-del" title="Löschen">🗑</button></td>' +
      '</tr>' +
      // Detailansicht: klappt per Doppelklick auf die Zeile (oder ueber ✎) auf
      '<tr class="wl-edit-row" data-id="'+s.id+'" hidden><td colspan="12"><div class="wl-detail">' +
        '<div class="wl-detail-kopf">'+assetIconHtml(s.asset)+' <b>'+esc(s.asset)+'</b> <span class="muted">'+esc(wlDatumLabel(s))+'</span></div>' +
        '<div class="wl-detail-grid">' +
          '<label>Datum<input type="date" class="wle-date" value="'+s.date+'"></label>' +
          '<label>Asset<input type="text" class="wle-asset" value="'+esc(s.asset)+'" placeholder="z.B. BTC"></label>' +
          '<label>Timeframe(s)<input type="text" class="wle-tf" value="'+esc(s.tf||'')+'" placeholder="z.B. 1D + 3D"></label>' +
          '<label>Ergebnis<select class="wle-status">'+statusOptionsHtml(st)+'</select></label>' +
          '<label>Setup-Note'+auswahlHtml('wle-note', [['','–']].concat(WL_NOTEN.map(n => [n, n])), s.note)+'</label>' +
          '<label>Event'+auswahlHtml('wle-event', [['','–'],['single','Single Bottom'],['double','Double Bottom']], s.eventTyp)+'</label>' +
          '<label>Multi-Timeframe'+auswahlHtml('wle-mtf', [['','–'],['1','1 Timeframe'],['2','2 Timeframes'],['3','3 Timeframes']], s.mtf ? String(s.mtf) : '')+'</label>' +
          '<label>Marktphase'+auswahlHtml('wle-phase', [['','–'],['uptrend','Uptrend'],['downtrend','Downtrend'],['ranging','Range']], s.marktphase)+'</label>' +
          '<label>Pattern'+auswahlHtml('wle-pattern', [['','–'],['valid','valid'],['clean','clean'],['choppy','choppy']], s.pattern)+'</label>' +
          '<label>Kerzen'+auswahlHtml('wle-candles', [['','–'],['pivot','Pivot Candles'],['decent','Decent Candles'],['gap','Gap Candles'],['mini','Mini Candles']], s.candles)+'</label>' +
          '<label>Divergenz lokal'+auswahlHtml('wle-divlokal', [['','–'],['rsi','RSI Div.'],['none','No Div.'],['hidden','RSI Hidden Div.']], s.divLokal)+'</label>' +
          '<label>Divergenz strukturell'+auswahlHtml('wle-divstruktur', [['','–'],['rsi','RSI Div.'],['none','No Div.'],['hidden','RSI Hidden Div.']], s.divStruktur)+'</label>' +
          '<label>Form'+auswahlHtml('wle-form', [['','–'],['bogen','Bogen (sauber)'],['bogen_unsauber','Bogen unsauber (z.B. nur eine Kerze dazwischen)'],['kein_bogen','kein Bogen']], s.form)+'</label>' +
          '<label class="wl-check"><input type="checkbox" class="wle-multiasset"'+(s.multiAsset?' checked':'')+'> Multi-Asset (mehrere Assets gleichzeitig)</label>' +
        '</div>' +
        '<label class="wl-detail-voll">Trade-ID <span class="wl-hint">gleiche Nummer bei mehreren Signalen = ein Trade</span>' +
          '<input type="text" class="wle-tradeid" value="'+esc(s.tradeId||'')+'" placeholder="z.B. 7"></label>' +
        '<label class="wl-detail-voll">Notiz (kurz)<input type="text" class="wle-notiz" value="'+esc(s.notiz||'')+'" placeholder="kurze Notiz für die Tabelle"></label>' +
        '<label class="wl-detail-voll">Details<textarea class="wle-details" rows="5" placeholder="Ausführliche Analyse: Kontext, Divergenzen, Entry/SL-Überlegungen, was gelernt…">'+esc(s.details||'')+'</textarea></label>' +
        '<div class="wl-detail-aktionen">' +
          '<button type="button" class="wl-save">Speichern</button>' +
          '<button type="button" class="wl-cancel ghost">Schließen</button>' +
        '</div>' +
      '</div></td></tr>';
    }).join('');

    el.innerHTML =
      '<div class="stats" style="margin-bottom:10px">' +
        '<div class="stat"><div class="v">'+signale.length+'</div><div class="l">Signale</div></div>' +
        '<div class="stat"><div class="v">'+anzTrades+'</div><div class="l">Trades</div></div>' +
        '<div class="stat"><div class="v">'+assetsAnzahl+'</div><div class="l">Assets</div></div>' +
        '<div class="stat"><div class="v pnl-pos">'+anzWin+'</div><div class="l">Win</div></div>' +
        '<div class="stat"><div class="v pnl-amber">'+anzBeWin+'</div><div class="l">BE Win</div></div>' +
        '<div class="stat"><div class="v pnl-orange">'+anzBeLoss+'</div><div class="l">BE Loss</div></div>' +
        '<div class="stat"><div class="v pnl-neg">'+anzLose+'</div><div class="l">Lose</div></div>' +
        '<div class="stat"><div class="v" style="color:var(--accent)">'+anzNoEntry+'</div><div class="l">No Entry</div></div>' +
      '</div>' +
      '<div class="muted" style="margin:-4px 0 10px">Ergebnis-Zahlen zählen Trades – Signale mit derselben Trade-ID zählen als einer.</div>' +
      '<div class="wl-toolbar">' +
        '<span class="muted">🔍 Ziehen zum Hineinzoomen · Doppelklick zum Zurücksetzen</span>' +
        (zoomAktiv ? '<button type="button" class="btn ghost" id="wlZoomReset">Zoom zurücksetzen</button>' : '') +
      '</div>' +
      '<div class="wl-chart-wrap" id="wlChartWrap">' +
        '<svg viewBox="0 0 '+B+' '+H+'" preserveAspectRatio="none" class="wl-svg" id="wlSvg">' +
          preisGitter + zeitGitter + clusterBaender +
          '<path class="wl-btc-area" d="'+flaeche+'"/>' +
          '<path class="wl-btc-line" d="'+linie+'"/>' +
          tradeLinien +
          '<rect id="wlSelRect" class="wl-sel-rect" x="0" y="'+PADT+'" width="0" height="'+PLOTH+'" style="display:none"/>' +
          '<rect id="wlHitArea" x="'+PADL+'" y="'+PADT+'" width="'+PLOTW+'" height="'+PLOTH+'" fill="transparent" style="cursor:crosshair"/>' +
        '</svg>' +
        '<div class="wl-markers">'+markerHtml+'</div>' +
        '<div id="wlTooltip" class="wl-tooltip" style="display:none"></div>' +
      '</div>' +
      '<form class="addbar" id="wlAddForm" autocomplete="off" style="margin-top:16px">' +
        '<div class="addrow">' +
          '<input type="date" id="wlNewDate" required>' +
          '<input type="text" id="wlNewAsset" placeholder="Asset (z.B. BTC)" maxlength="20" required style="max-width:110px">' +
          '<input type="text" id="wlNewTf" placeholder="TF (z.B. 1D)" maxlength="20" style="max-width:90px">' +
          '<select id="wlNewStatus">'+statusOptionsHtml('')+'</select>' +
          '<input type="text" id="wlNewNotiz" placeholder="Notiz (optional)" maxlength="200" style="flex:1;min-width:140px">' +
          '<button type="submit">+ Hinzufügen</button>' +
        '</div>' +
        '<div class="te-msg muted" id="wlAddMsg">Details (Event, Multi-TF, Multi-Asset, Form) danach per Doppelklick auf die Zeile ergänzen.</div>' +
      '</form>' +
      '<div class="wl-table-wrap">' +
        '<table class="wl-table">' +
          '<thead><tr>' +
            '<th class="wl-sortable" data-sort="date">Datum'+(sortSpalte==='date'?(sortRichtung==='asc'?' ▲':' ▼'):'')+'</th>' +
            '<th>Trade</th>' +
            '<th class="wl-sortable" data-sort="asset">Asset'+(sortSpalte==='asset'?(sortRichtung==='asc'?' ▲':' ▼'):'')+'</th>' +
            '<th>TF</th><th>Setup</th><th>Phase</th><th>Pattern</th><th>Divergenz</th>' +
            '<th>Note</th><th>Ergebnis</th><th>Notiz</th><th></th>' +
          '</tr></thead>' +
          '<tbody>'+tabelle+'</tbody>' +
        '</table>' +
      '</div>';

    // Tooltips für die Marker
    const wrap = document.getElementById('wlChartWrap');
    const tooltip = document.getElementById('wlTooltip');
    wrap.querySelectorAll('.wl-marker').forEach(m => {
      const p = marker[+m.dataset.i];
      m.addEventListener('pointerenter', () => {
        tooltip.style.display = '';
        tooltip.style.left = m.style.left;
        tooltip.style.top = m.style.top;
        tooltip.innerHTML = esc(p.titel);
      });
      m.addEventListener('pointerleave', () => { tooltip.style.display = 'none'; });
    });

    // Zoom per Ziehen auf der Chart-Fläche
    const svg = document.getElementById('wlSvg');
    const hit = document.getElementById('wlHitArea');
    const selRect = document.getElementById('wlSelRect');
    let ziehStart = null;
    function pxVonEvent(ev){
      const rect = svg.getBoundingClientRect();
      return Math.min(Math.max((ev.clientX - rect.left) / rect.width * B, PADL), B - PADR);
    }
    hit.addEventListener('pointerdown', ev => {
      ziehStart = pxVonEvent(ev);
      hit.setPointerCapture(ev.pointerId);
      selRect.style.display = '';
      selRect.setAttribute('x', ziehStart.toFixed(1));
      selRect.setAttribute('width', '0');
    });
    hit.addEventListener('pointermove', ev => {
      if (ziehStart === null) return;
      const cur = pxVonEvent(ev);
      const a = Math.min(ziehStart, cur), b = Math.max(ziehStart, cur);
      selRect.setAttribute('x', a.toFixed(1));
      selRect.setAttribute('width', (b-a).toFixed(1));
    });
    hit.addEventListener('pointerup', ev => {
      if (ziehStart === null) return;
      const cur = pxVonEvent(ev);
      selRect.style.display = 'none';
      const distanz = Math.abs(cur - ziehStart);
      if (distanz > 10) {
        const a = Math.min(ziehStart, cur), b = Math.max(ziehStart, cur);
        const neuMin = tVonX(a), neuMax = tVonX(b);
        if (neuMax - neuMin > 3 * 86400000) domain = [neuMin, neuMax];
        render();
      }
      ziehStart = null;
    });
    hit.addEventListener('dblclick', () => { domain = [fullMinT, fullMaxT]; render(); });

    const resetBtn = document.getElementById('wlZoomReset');
    if (resetBtn) resetBtn.addEventListener('click', () => { domain = [fullMinT, fullMaxT]; render(); });

    // Neues Signal hinzufügen
    const addForm = document.getElementById('wlAddForm');
    const addMsg = document.getElementById('wlAddMsg');
    addForm.addEventListener('submit', async ev => {
      ev.preventDefault();
      const date = document.getElementById('wlNewDate').value;
      const asset = document.getElementById('wlNewAsset').value.trim();
      if (!date || !asset) return;
      const body = {
        date, asset,
        tf: document.getElementById('wlNewTf').value.trim() || null,
        status: document.getElementById('wlNewStatus').value,
        notiz: document.getElementById('wlNewNotiz').value.trim() || null
      };
      addMsg.textContent = '';
      try {
        await api('/watchlist', { method: 'POST', body: JSON.stringify(body) });
        await ladeUndZeichne();
      } catch(e) { addMsg.textContent = 'Fehler: ' + e.message; }
    });

    // Spalten-Sortierung (Datum/Asset), Klick auf Kopfzelle togglet Richtung
    el.querySelectorAll('.wl-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const spalte = th.dataset.sort;
        if (sortSpalte === spalte) sortRichtung = sortRichtung === 'asc' ? 'desc' : 'asc';
        else { sortSpalte = spalte; sortRichtung = spalte === 'asset' ? 'asc' : 'desc'; }
        render();
      });
    });

    // Bearbeiten / Löschen in der Tabelle
    const tableWrap = el.querySelector('.wl-table-wrap');

    // Maus ueber einer Zeile mit Trade-ID hebt alle Zeilen desselben Trades hervor
    tableWrap.addEventListener('mouseover', ev => {
      const tr = ev.target.closest('tr[data-trade]');
      tableWrap.querySelectorAll('tr.wl-trade-hover').forEach(r => r.classList.remove('wl-trade-hover'));
      if (!tr) return;
      tableWrap.querySelectorAll('tr[data-trade="'+tr.dataset.trade.replace(/"/g,'\\"')+'"]')
        .forEach(r => r.classList.add('wl-trade-hover'));
    });
    tableWrap.addEventListener('mouseleave', () => {
      tableWrap.querySelectorAll('tr.wl-trade-hover').forEach(r => r.classList.remove('wl-trade-hover'));
    });

    // Doppelklick (bzw. Doppeltipp) auf eine Zeile klappt die Detailansicht auf/zu
    tableWrap.addEventListener('dblclick', ev => {
      const tr = ev.target.closest('tr[data-id]');
      if (!tr || tr.classList.contains('wl-edit-row')) return;
      const detail = tableWrap.querySelector('tr.wl-edit-row[data-id="'+tr.dataset.id+'"]');
      if (detail) detail.hidden = !detail.hidden;
    });
    tableWrap.addEventListener('click', async ev => {
      const editBtn = ev.target.closest('.wl-edit');
      if (editBtn) {
        const id = editBtn.closest('tr').dataset.id;
        const editRow = tableWrap.querySelector('tr.wl-edit-row[data-id="'+id+'"]');
        if (editRow) editRow.hidden = !editRow.hidden;
        return;
      }
      const cancelBtn = ev.target.closest('.wl-cancel');
      if (cancelBtn) { cancelBtn.closest('tr').hidden = true; return; }

      const saveBtn = ev.target.closest('.wl-save');
      if (saveBtn) {
        const row = saveBtn.closest('tr');
        const id = row.dataset.id;
        const body = {
          date: row.querySelector('.wle-date').value,
          asset: row.querySelector('.wle-asset').value.trim(),
          tf: row.querySelector('.wle-tf').value.trim() || null,
          status: row.querySelector('.wle-status').value,
          eventTyp: row.querySelector('.wle-event').value,
          mtf: row.querySelector('.wle-mtf').value,
          multiAsset: row.querySelector('.wle-multiasset').checked,
          form: row.querySelector('.wle-form').value,
          notiz: row.querySelector('.wle-notiz').value.trim() || null,
          details: row.querySelector('.wle-details').value.trim() || null,
          tradeId: row.querySelector('.wle-tradeid').value.trim() || null,
          note: row.querySelector('.wle-note').value,
          marktphase: row.querySelector('.wle-phase').value,
          pattern: row.querySelector('.wle-pattern').value,
          candles: row.querySelector('.wle-candles').value,
          divLokal: row.querySelector('.wle-divlokal').value,
          divStruktur: row.querySelector('.wle-divstruktur').value
        };
        saveBtn.disabled = true; saveBtn.textContent = 'Speichert…';
        try { await api('/watchlist/'+id, { method: 'PATCH', body: JSON.stringify(body) }); await ladeUndZeichne(); }
        catch(e) { saveBtn.disabled = false; saveBtn.textContent = 'Speichern'; alert('Fehler: ' + e.message); }
        return;
      }

      const delBtn = ev.target.closest('.wl-del');
      if (delBtn) {
        if (delBtn.dataset.confirm !== '1') {
          delBtn.dataset.confirm = '1'; delBtn.textContent = '⚠️';
          setTimeout(() => { if (delBtn.dataset.confirm==='1'){ delete delBtn.dataset.confirm; delBtn.textContent='🗑'; } }, 4000);
          return;
        }
        const id = delBtn.closest('tr').dataset.id;
        try { await api('/watchlist/'+id, { method: 'DELETE' }); await ladeUndZeichne(); }
        catch(e) { alert('Konnte nicht gelöscht werden: ' + e.message); }
      }
    });
  }

  async function ladeUndZeichne(){
    try {
      signale = await api('/watchlist');
    } catch(e) {
      el.innerHTML = '<div class="empty">Watchlist konnte nicht geladen werden.</div>';
      return;
    }
    render();
  }

  ladeUndZeichne();
})();

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
      let markHtml = '<span class="muted">–</span>';
      let last = null;
      if (p && isFinite(p.last)){
        last = p.last;
        const pnl = dir*(last-avg)*size; total += pnl;
        const pct = avg ? dir*(last-avg)/avg*100 : 0;
        pnlHtml = '<span class="'+(pnl>=0?'pnl-pos':'pnl-neg')+'">'+fmt(pnl)+'</span><div class="muted" style="font-size:11px">'+(pct>=0?'+':'')+pct.toFixed(1)+'%</div>';
        markHtml = '<span class="kurs-badge">'+rundPreis(last)+'</span>';
      } else allPriced = false;
      const beSchon = o.sl != null && avg > 0 && (dir > 0 ? o.sl >= avg : o.sl <= avg);
      const slHtml = o.sl == null ? '<span class="muted">–</span>'
        : '<span class="'+(beSchon?'pnl-amber':'pnl-neg')+'">'+o.sl+'</span>';
      const tpHtml = o.tp == null ? '<span class="muted">–</span>' : '<span class="pnl-pos">'+o.tp+'</span>';
      const realHtml = o.realizedPnl ? '<span class="'+(Number(o.realizedPnl)>=0?'pnl-pos':'pnl-amber')+'">'+fmt(o.realizedPnl)+'</span>' : '<span class="muted">–</span>';
      parts.push(
        '<div class="lp-trow">' +
          '<div class="lp-col"><div class="lp-asset"'+(o.name?' title="'+esc(o.name)+'"':'')+'>'+coinIcon(o.ticker, o.asset)+'<span class="t">'+esc(o.asset)+'</span></div><div class="muted" style="font-size:11px">'+esc(o.side)+'</div></div>' +
          '<div class="lp-col lp-sltp"><div class="lp-stp-val">'+slHtml+'</div><div class="lp-stp-val">'+rundPreis(avg)+'</div><div class="lp-stp-val">'+tpHtml+'</div></div>' +
          '<div class="lp-col lp-kurs-col">'+markHtml+'</div>' +
          '<div class="lp-col">'+pnlHtml+'</div>' +
          '<div class="lp-col">'+realHtml+'</div>' +
          '<div class="lp-col lp-manage"><span class="lp-toggle" role="button" data-idx="'+idx+'">verwalten</span></div>' +
        '</div>' +
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
      '<div class="lp-table-wrap"><div class="lp-table">' +
        '<div class="lp-thead">' +
          '<div class="lp-col">Position</div>' +
          '<div class="lp-col lp-sltp"><span>SL</span><span>Entry</span><span>TP</span></div>' +
          '<div class="lp-col lp-kurs-col">Kurs</div>' +
          '<div class="lp-col">Unrealisiert</div>' +
          '<div class="lp-col">Realisiert</div>' +
          '<div class="lp-col"></div>' +
        '</div>' +
        parts.join('') +
      '</div></div>' +
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

  // Performance-Verlauf
  const elPerfChart = document.getElementById('perfChart');
  const elPerfSummary = document.getElementById('perfSummary');
  const elPerfStamp = document.getElementById('perfStamp');
  const elPerfTabs = document.getElementById('perfRangeTabs');
  let perfRange = '1y';
  const perfBackfillVersucht = new Set();
  const perfSnapshotHeute = new Set();

  if (elPerfTabs) elPerfTabs.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => {
      perfRange = btn.dataset.range;
      elPerfTabs.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b === btn));
      ladePerformance();
    });
  });

  function perfPunkte(verlauf, breite, hoehe, padL, padR, padT, padB){
    const werte = verlauf.map(v => v.value);
    let min = Math.min(...werte), max = Math.max(...werte);
    if (min === max) { min -= 1; max += 1; }
    const spanne = max - min;
    min -= spanne * 0.08; max += spanne * 0.08;
    const innenB = breite - padL - padR, innenH = hoehe - padT - padB;
    return verlauf.map((v, i) => ({
      x: padL + (verlauf.length > 1 ? i / (verlauf.length - 1) * innenB : innenB / 2),
      y: padT + innenH - (v.value - min) / (max - min) * innenH,
      ...v
    }));
  }

  function zeichnePerf(verlauf){
    if (!elPerfChart) return;
    if (!verlauf.length){
      elPerfChart.innerHTML = '<div class="empty">Noch kein Verlauf vorhanden.</div>';
      if (elPerfSummary) elPerfSummary.innerHTML = '';
      return;
    }
    const B = 640, H = 220, padL = 54, padR = 12, padT = 14, padB = 26;
    const pts = perfPunkte(verlauf, B, H, padL, padR, padT, padB);
    const erster = pts[0], letzter = pts[pts.length - 1];
    const diff = letzter.value - erster.value;
    const diffPct = erster.value ? diff / erster.value * 100 : 0;
    const hoch = diff >= 0;
    const farbe = hoch ? 'var(--green)' : 'var(--red)';

    const linie = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    const flaeche = linie + ' L' + letzter.x.toFixed(1) + ',' + (H - padB).toFixed(1) +
      ' L' + erster.x.toFixed(1) + ',' + (H - padB).toFixed(1) + ' Z';

    const werte = verlauf.map(v => v.value);
    const min = Math.min(...werte), max = Math.max(...werte), mitte = (min + max) / 2;
    const yFuer = w => padT + (H - padT - padB) - (w - (min - (max - min) * 0.08)) / ((max - min) * 1.16) * (H - padT - padB);
    const gitterlinien = [max, mitte, min].map(w => {
      const y = yFuer(w).toFixed(1);
      return '<line class="perf-grid" x1="'+padL+'" y1="'+y+'" x2="'+(B-padR)+'" y2="'+y+'"/>' +
        '<text class="perf-grid-label" x="'+(padL-8)+'" y="'+y+'" text-anchor="end" dominant-baseline="middle">'+fmt(w).replace('+','')+'</text>';
    }).join('');

    const datLabel = d => new Date(d+'T00:00:00').toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year: perfRange==='all'||perfRange==='1y' ? '2-digit' : undefined });
    const xAchse = [erster, letzter].map((p,i) =>
      '<text class="perf-grid-label" x="'+p.x.toFixed(1)+'" y="'+(H-6)+'" text-anchor="'+(i===0?'start':'end')+'">'+datLabel(p.date)+'</text>'
    ).join('');

    const geschaetztDabei = verlauf.some(v => v.estimated);

    elPerfChart.innerHTML =
      '<svg viewBox="0 0 '+B+' '+H+'" class="perf-svg" preserveAspectRatio="none" id="perfSvg">' +
        gitterlinien +
        '<path class="perf-area" d="'+flaeche+'" fill="'+farbe+'"/>' +
        '<path class="perf-line" d="'+linie+'" stroke="'+farbe+'"/>' +
        '<circle class="perf-enddot" cx="'+letzter.x.toFixed(1)+'" cy="'+letzter.y.toFixed(1)+'" r="4" fill="'+farbe+'"/>' +
        '<line id="perfCrosshair" class="perf-crosshair" x1="0" y1="'+padT+'" x2="0" y2="'+(H-padB)+'" style="display:none"/>' +
        '<circle id="perfHoverDot" class="perf-enddot" r="4" fill="'+farbe+'" style="display:none"/>' +
        xAchse +
        '<rect id="perfHitArea" x="'+padL+'" y="0" width="'+(B-padL-padR)+'" height="'+H+'" fill="transparent"/>' +
      '</svg>' +
      '<div id="perfTooltip" class="perf-tooltip" style="display:none"></div>';

    if (elPerfSummary) elPerfSummary.innerHTML =
      '<div class="stat"><div class="v">'+fmt(letzter.value).replace('+','')+'</div><div class="l">Aktueller Wert</div></div>' +
      '<div class="stat"><div class="v '+(hoch?'pnl-pos':'pnl-neg')+'">'+(hoch?'+':'')+fmt(diff).replace('+','')+'</div><div class="l">Veränderung</div></div>' +
      '<div class="stat"><div class="v '+(hoch?'pnl-pos':'pnl-neg')+'">'+(hoch?'+':'')+diffPct.toFixed(1)+'%</div><div class="l">seit '+datLabel(erster.date)+'</div></div>';

    if (elPerfStamp) elPerfStamp.textContent = geschaetztDabei ? '· Teile geschätzt (≈ auf Basis aktueller Bestände)' : '';

    // Hover: Fadenkreuz + Tooltip auf die naechstgelegene Tagesposition einrasten.
    const svg = document.getElementById('perfSvg');
    const hitArea = document.getElementById('perfHitArea');
    const crosshair = document.getElementById('perfCrosshair');
    const hoverDot = document.getElementById('perfHoverDot');
    const tooltip = document.getElementById('perfTooltip');
    if (hitArea && svg) {
      const zeigePunkt = (i) => {
        const p = pts[i];
        crosshair.setAttribute('x1', p.x.toFixed(1)); crosshair.setAttribute('x2', p.x.toFixed(1));
        crosshair.style.display = ''; hoverDot.style.display = '';
        hoverDot.setAttribute('cx', p.x.toFixed(1)); hoverDot.setAttribute('cy', p.y.toFixed(1));
        tooltip.style.display = '';
        tooltip.style.left = (p.x / B * 100) + '%';
        tooltip.style.top = Math.max(0, p.y - 46) + 'px';
        tooltip.innerHTML = '<div class="perf-tt-val">'+(p.estimated?'≈ ':'')+fmt(p.value).replace('+','')+'</div><div class="perf-tt-date">'+datLabel(p.date)+'</div>';
      };
      const verbergen = () => { crosshair.style.display='none'; hoverDot.style.display='none'; tooltip.style.display='none'; };
      hitArea.addEventListener('pointermove', ev => {
        const rect = svg.getBoundingClientRect();
        const xSvg = (ev.clientX - rect.left) / rect.width * B;
        let nahester = 0, besterAbstand = Infinity;
        pts.forEach((p, i) => { const a = Math.abs(p.x - xSvg); if (a < besterAbstand){ besterAbstand = a; nahester = i; } });
        zeigePunkt(nahester);
      });
      hitArea.addEventListener('pointerleave', verbergen);
    }
  }

  async function ladePerformance(){
    if (!aktivesPortfolioId || !elPerfChart) return;
    const pid = aktivesPortfolioId;
    elPerfChart.innerHTML = '<div class="empty">Lade…</div>';
    try {
      let verlauf = await api('/portfolio/history?portfolioId='+pid+'&range='+perfRange);
      if (!verlauf.length && !perfBackfillVersucht.has(pid)){
        perfBackfillVersucht.add(pid);
        elPerfChart.innerHTML = '<div class="empty">Erstelle geschätzten Verlauf (einmalig, kann ~15s dauern)…</div>';
        try { await api('/portfolio/backfill?portfolioId='+pid, { method:'POST' }); } catch(e){ /* Chart zeigt notfalls nur ab heute an */ }
      }
      if (!perfSnapshotHeute.has(pid)){
        perfSnapshotHeute.add(pid);
        try { await api('/portfolio/snapshot?portfolioId='+pid, { method:'POST' }); } catch(e){}
      }
      verlauf = await api('/portfolio/history?portfolioId='+pid+'&range='+perfRange);
      if (pid !== aktivesPortfolioId) return;
      zeichnePerf(verlauf);
    } catch(e){
      if (pid !== aktivesPortfolioId) return;
      elPerfChart.innerHTML = '<div class="err">Verlauf nicht ladbar: '+esc(e.message)+'</div>';
      if (elPerfSummary) elPerfSummary.innerHTML = '';
    }
  }

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
    if (!aktivesPortfolioId) { elChart.innerHTML = ''; elList.innerHTML = ''; if (elPerfChart) elPerfChart.innerHTML = ''; return; }
    elChart.innerHTML = '<div class="empty">Lade…</div>';
    elList.innerHTML = '<div class="empty">Lade…</div>';
    ladePerformance();
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
