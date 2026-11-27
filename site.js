// made 20261126T234550
// The code of every page. Each part runs only on the pages that have it.
// Saved in the browser (each with a version number, so a later layout can read older saves):
//   sarf_levels   { v: 1, m: { ID: { l: 0 to 3, d: when last changed } } }   (old ticks in sarf_ticks become level 3, once)
//   sarf_notebook { v: 1, notes: [ { id, title, text, links: [ { t: 'c' criterion, 't' topic, 's' section, r: its ID } ], made, changed } ] }
//   settings: sarf_term_face, sarf_lines, sarf_prio, sarf_level_show, sarf_view, sarf_filters, sarf_nb_order,
//             sarf_open (which criteria headings are open), sarf_crit_all, sarf_gl_all, sarf_app_all (the Show all switches)
// Every change reads the latest save first and changes only its own part, so two open tabs never undo each other.
(function () {
  'use strict';
  var b = document.body, order = ['ar', 'en', 'tr'];
  // the four names come from the settings file, through the page, so they are written in one place only
  var LEVELS = (b.dataset.levels || 'Unmarked|Low|Medium|High').split('|');
  function $(id) { return document.getElementById(id); }
  function all(q, root) { return Array.prototype.slice.call((root || document).querySelectorAll(q)); }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function parse(s, d) { try { var x = JSON.parse(s); return x === null || x === undefined ? d : x; } catch (e) { return d; } }
  function on(q, ev, fn) { all(q).forEach(function (x) { x.addEventListener(ev, fn); }); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function choose(seg, v) { all('button', seg).forEach(function (x) { x.classList.toggle('on', x.dataset.v === String(v)); }); }
  var DATA = $('data') ? parse($('data').textContent, {}) : {};
  var NAME = DATA.levelName || 'Confidence';
  var BAR = '<i></i>';
  var LINE = {}; (DATA.lines || []).forEach(function (x, i) { x.pos = i; LINE[x.id] = x; });
  var TOPIC = {}; (DATA.topics || []).forEach(function (x) { TOPIC[x.id] = x; });
  var SECTION = {}; (DATA.sections || []).forEach(function (x, i) { x.pos = i; SECTION[x.code] = x; });

  // ---------- levels: read fresh every time
  function levels() {
    var s = parse(load('sarf_levels'), null);
    if (s && s.v === 1 && s.m) return s;
    var m = {}, t = parse(load('sarf_ticks'), {}), now = Date.now();   // the old ticks, once
    Object.keys(t || {}).forEach(function (k) { if (t[k]) m[k] = { l: 3, d: now }; });
    s = { v: 1, m: m }; save('sarf_levels', JSON.stringify(s)); return s;
  }
  function lv(id) { var x = levels().m[id]; return x ? x.l : 0; }
  function setLevel(id, l) {
    var s = levels();
    if (l) s.m[id] = { l: l, d: Date.now() }; else delete s.m[id];
    save('sarf_levels', JSON.stringify(s)); paint(); refresh();
  }
  function paint() {
    var m = levels().m;
    all('.lv[data-id]').forEach(function (x) {
      var l = m[x.dataset.id] ? m[x.dataset.id].l : 0;
      x.dataset.l = l; x.setAttribute('aria-label', NAME + ': ' + LEVELS[l].toLowerCase()); x.title = NAME + ': ' + LEVELS[l];
    });
  }
  var refresh = function () {};   // each page sets what else changes with a level

  // a click sets the level under the pointer: the left third Low, the middle Medium, the right High;
  // the level it is already at steps down one (from Low, it empties). From the keyboard, Enter or Space moves up one,
  // and the arrow keys move up and down.
  function third(t, x) { var r = t.getBoundingClientRect(); return Math.min(3, Math.max(1, Math.floor((x - r.left) / (r.width / 3)) + 1)); }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('button.lv[data-id]') : null;
    if (!t) return;
    var now = lv(t.dataset.id);
    if (!e.detail) { setLevel(t.dataset.id, (now + 1) % 4); return; }   // the keyboard
    var n = third(t, e.clientX); setLevel(t.dataset.id, now === n ? n - 1 : n);
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target.closest ? e.target.closest('button.lv[data-id]') : null;
    if (!t || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
    e.preventDefault(); setLevel(t.dataset.id, Math.min(3, Math.max(0, lv(t.dataset.id) + (e.key === 'ArrowRight' ? 1 : -1))));
  });
  document.addEventListener('mousemove', function (e) {   // shade the third the pointer is on
    var t = e.target.closest ? e.target.closest('button.lv[data-id]') : null;
    if (t) t.dataset.h = third(t, e.clientX);
  });
  document.addEventListener('mouseout', function (e) {
    var t = e.target.closest ? e.target.closest('button.lv[data-id]') : null;
    if (t && !t.contains(e.relatedTarget)) delete t.dataset.h;
  });

  // ---------- the bar of pages stays at the top; the bars that stick under it on the criteria page start below it
  var nav = document.querySelector('.nav');
  function navHeight() { if (nav) document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px'); }
  navHeight(); window.addEventListener('resize', navHeight);

  // ---------- settings: a panel that slides in over the right of the page
  var drawer = $('drawer'), navSet = document.querySelector('.nav-set');
  var shutTimer = null;
  function setOpen(o) {
    clearTimeout(shutTimer); navSet.setAttribute('aria-expanded', String(o)); b.classList.toggle('drawer-open', o);
    if (o) { drawer.classList.remove('closing'); drawer.hidden = false; drawer.querySelector('.dclose').focus(); return; }
    drawer.classList.add('closing'); navSet.focus();
    shutTimer = setTimeout(function () { drawer.hidden = true; drawer.classList.remove('closing'); }, 200);
  }
  if (drawer && navSet) {
    navSet.addEventListener('click', function () { setOpen(drawer.hidden || drawer.classList.contains('closing')); });
    drawer.querySelector('.dclose').addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden && !drawer.classList.contains('closing')) setOpen(false); });
    if (location.hash === '#settings') setOpen(true);
  }
  on('.gear', 'click', function () { var p = $('setp'); p.hidden = !p.hidden; this.setAttribute('aria-expanded', String(!p.hidden)); });
  var MSG = {
    all: 'You will see every line. Lines only for Year 2 carry a Y2 tag.',
    y1: 'The lines only for Year 2 will be hidden. Choose this only if you are in Year 1.',
    y2: 'The Y2 tags will be hidden. Choose this only if you are in Year 2; in Year 1 you may end up learning more than you need.'
  };

  // our own "are you sure?" box, drawn like the rest of the page (the browser's own box can be blocked)
  var askBox = el('div', 'ask'); askBox.hidden = true; askBox.setAttribute('role', 'alertdialog'); b.appendChild(askBox);
  var askNo = null;
  function closeAsk(said) { if (askBox.hidden) return; askBox.hidden = true; var f = askNo; askNo = null; if (!said && f) f(); }
  function ask(anchor, text, yesLabel, yes, no) {
    closeAsk(false); askBox.textContent = ''; askBox.appendChild(el('p', '', text));
    var row = el('div', 'ask-b'), y = el('button', 'danger', yesLabel), n = el('button', '', 'Cancel'); y.type = n.type = 'button';
    y.addEventListener('click', function () { closeAsk(true); yes(); }); n.addEventListener('click', function () { closeAsk(false); });
    row.appendChild(n); row.appendChild(y); askBox.appendChild(row); askNo = no || null; askBox.hidden = false;
    var r = anchor.getBoundingClientRect(), w = askBox.offsetWidth;
    askBox.style.top = (r.bottom + window.scrollY + 6) + 'px';
    askBox.style.left = Math.max(8, Math.min(r.right + window.scrollX - w, window.scrollX + document.documentElement.clientWidth - w - 8)) + 'px';
    n.focus();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAsk(false); });
  document.addEventListener('mousedown', function (e) { if (!askBox.hidden && !askBox.contains(e.target)) closeAsk(false); }, true);

  // our own drop-down list, drawn like the rest of the page
  function dropdown(dd, onPick) {
    var btn = dd.querySelector('.dd-btn'), list = dd.querySelector('.dd-list'), opts = all('[role=option]', list);
    function shut() { list.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    function show(v) { opts.forEach(function (o) { var y = o.dataset.v === v; o.setAttribute('aria-selected', String(y)); o.classList.toggle('on', y); if (y) btn.querySelector('span').textContent = o.textContent; }); }
    function openList() {
      all('.dd-list').forEach(function (l) { if (l !== list) l.hidden = true; });
      list.hidden = false; btn.setAttribute('aria-expanded', 'true');
      var box = dd.closest('.drawer'), limit = box ? box.getBoundingClientRect().bottom : window.innerHeight;
      dd.classList.toggle('up', btn.getBoundingClientRect().bottom + list.offsetHeight + 8 > limit);
      (list.querySelector('.on') || opts[0]).focus({ preventScroll: true });
    }
    btn.addEventListener('click', function () { if (list.hidden) openList(); else shut(); });
    btn.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openList(); } });
    opts.forEach(function (o, i) {
      o.tabIndex = -1;
      o.addEventListener('click', function () { shut(); btn.focus({ preventScroll: true }); onPick(o.dataset.v); });
      o.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown') { e.preventDefault(); (opts[i + 1] || o).focus({ preventScroll: true }); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); (opts[i - 1] || o).focus({ preventScroll: true }); }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); o.click(); }
        else if (e.key === 'Escape' || e.key === 'Tab') { shut(); btn.focus(); }
      });
    });
    document.addEventListener('click', function (e) { if (!dd.contains(e.target)) shut(); });
    return show;
  }

  var SETTING = {
    face: { key: 'sarf_term_face', start: b.dataset.face, apply: function (v) {
      if (b.dataset.page === 'glossary' && v === 'en') v = 'tr';   // the glossary has no English face
      b.className = b.className.replace(/\bface-\w+/g, '').trim() + ' face-' + v;
      all('.row').forEach(function (r) { r.classList.remove('lf-ar', 'lf-en', 'lf-tr'); }); } },
    lines: { key: 'sarf_lines', start: 'all', ask: true, apply: function (v) { b.classList.remove('lines-y1', 'lines-y2'); if (v !== 'all') b.classList.add('lines-' + v); } },
    prio: { key: 'sarf_prio', start: 'squares', apply: function (v) { b.classList.toggle('prio-bar', v === 'bar'); } },
    pcol: { key: 'sarf_prio_colour', start: 'traffic', apply: function (v) { b.classList.toggle('prio-mono', v === 'mono'); } },
    level: { key: 'sarf_level_show', start: 'show', apply: function (v) { b.classList.toggle('no-level', v === 'hide'); } },
    arfont: { key: 'sarf_ar_font', start: 'amiri', apply: function (v) { font('ar', v); } },
    arsize: { key: 'sarf_ar_size', start: '1.2', apply: function (v) { document.documentElement.style.setProperty('--ar-scale', v === '1' ? '1' : '1.2'); } },
    enfont: { key: 'sarf_en_font', start: 'poppins', apply: function (v) { font('en', v); } }
  };
  // fonts from Google Fonts are fetched only when a student chooses one, so they look the same on every device
  // each font: [its Google name, or '' for the device's own; the styles to fetch: real italics where the font has them]
  var FONTS = {
    ar: { plain: ['', ''], amiri: ['Amiri', 'wght@400;700'], naskh: ['Noto Naskh Arabic', 'wght@400;600;700'],
          sch: ['Scheherazade New', 'wght@400;600;700'] },
    en: { sans: ['', ''], poppins: ['Poppins', 'ital,wght@0,400;0,600;0,700;1,400;1,600', 'Lexend'], nunito: ['Nunito', 'ital,wght@0,400;0,600;0,700;1,400;1,600'],
          lexend: ['Lexend', 'wght@400;600;700'], didact: ['Didact Gothic', ''] }
  };
  // a student who chose a font that has left the list gets the closest one
  [['sarf_ar_font', { trad: 'amiri', typeset: 'amiri' }], ['sarf_en_font', { gothic: 'didact' }]].forEach(function (m) {
    var v = load(m[0]); if (m[1][v]) save(m[0], m[1][v]);
  });
  function font(kind, v) {
    var f = FONTS[kind][v] || ['', ''], web = f[0];
    if (web && !document.getElementById('font-' + web)) {
      var l = el('link'); l.id = 'font-' + web; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=' + web.replace(/ /g, '+') + (f[1] ? ':' + f[1] : '') + '&display=swap'; document.head.appendChild(l);
    }
    // a font that lacks the dotted transliteration letters (Poppins) borrows only those letters from a font that has them:
    // the browser fetches a tiny file holding just these letters, and draws every other letter in the chosen font
    if (f[2] && !document.getElementById('font-' + f[2] + '-letters')) {
      var k = el('link'); k.id = 'font-' + f[2] + '-letters'; k.rel = 'stylesheet';
      k.href = 'https://fonts.googleapis.com/css2?family=' + f[2] + ':wght@400;600;700&text=' + encodeURIComponent('ṣḥṭḍẓṢḤṬḌẒʿʾ') + '&display=swap';
      document.head.appendChild(k);
    }
    var names = (web ? '"' + web + '", ' : '') + (f[2] ? '"' + f[2] + '", ' : '');
    if (kind === 'ar') document.documentElement.style.setProperty('--ar-font', names);
    else document.documentElement.style.setProperty('--en-font', names + '"Segoe UI", Arial, sans-serif');
  }
  function current(name) { return load(SETTING[name].key) || SETTING[name].start; }
  Object.keys(SETTING).forEach(function (name) {
    var s = SETTING[name], c = document.querySelector('[data-set="' + name + '"]'), v = current(name), shown = function () {};
    s.apply(v);
    function set(nv, undo, anchor) {
      if (nv === v) return;
      function go() { save(s.key, nv); s.apply(nv); v = nv; shown(v); refresh(); }
      if (s.ask) ask(anchor || c, MSG[nv], 'Change it', go, undo); else go();
    }
    if (!c) return;
    if (c.classList.contains('dd')) {   // a drop-down list
      shown = dropdown(c, function (nv) { set(nv, function () { shown(v); }, c.querySelector('.dd-btn')); }); shown(v);
    } else if (c.tagName === 'INPUT') {   // an on-and-off switch
      c.checked = v === c.dataset.on; shown = function (x) { c.checked = x === c.dataset.on; };
      c.addEventListener('change', function () { set(c.checked ? c.dataset.on : c.dataset.off, function () { c.checked = !c.checked; }); });
    } else {   // two buttons side by side
      shown = function (x) { choose(c, x); }; choose(c, v);
      all('button', c).forEach(function (x) { x.addEventListener('click', function () { set(x.dataset.v, function () {}, x); }); });
    }
  });
  on('#clear-levels', 'click', function () {
    ask(this, 'Empty all your confidence bars on this device, on the criteria and the glossary? This cannot be undone.', 'Clear all', function () {
      save('sarf_levels', JSON.stringify({ v: 1, m: {} })); paint(); refresh();
    });
  });
  window.addEventListener('storage', function (e) { if (e.key === 'sarf_levels') { paint(); refresh(); } });
  window.addEventListener('pageshow', function () { paint(); refresh(); });
  function picks(name, key, done) {   // same-size boxes; any number on; saved
    var seg = document.querySelector('[data-picks="' + name + '"]'); if (!seg) return null;
    var on2 = parse(load(key), null); if (!Array.isArray(on2)) on2 = ['3', '2', '1', '0'];
    function show() { all('button', seg).forEach(function (x) { var y = on2.indexOf(x.dataset.v) >= 0; x.classList.toggle('on', y); x.setAttribute('aria-pressed', String(y)); }); }
    all('button', seg).forEach(function (x) {
      x.addEventListener('click', function () {
        var i = on2.indexOf(x.dataset.v); if (i >= 0) on2.splice(i, 1); else on2.push(x.dataset.v);
        save(key, JSON.stringify(on2)); show(); done();
      });
    });
    show(); return function (v) { return on2.indexOf(String(v)) >= 0; };
  }
  function faceNow() { return b.className.match(/face-(\w+)/)[1]; }
  function plain(html) {   // the wording as text, in the face shown now
    var d = el('div'); d.innerHTML = html;
    all({ en: '.f-ar,.f-tr', ar: '.f-en,.f-tr', tr: '.f-en,.f-ar' }[faceNow()], d).forEach(function (x) { x.remove(); });
    return d.textContent.replace(/\s+/g, ' ').trim();
  }
  function ago(d) {
    if (!d) return '';
    var n = Math.floor((Date.now() - d) / 86400000);
    return n < 1 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago';
  }
  function notesOn(id) { return readNotes().notes.filter(function (n) { return n.links.some(function (k) { return k.t === 'c' && k.r === id; }); }); }

  // ---------- the i button: a small pop-up with what is not needed every time
  var pop = el('div', 'pop'); pop.hidden = true; b.appendChild(pop); var popBtn = null;
  function item(label, value) {
    var p = el('div', 'mi'); p.appendChild(el('b', '', label));
    if (typeof value === 'string') p.appendChild(el('span', '', value)); else p.appendChild(value); pop.appendChild(p);
  }
  function html(s) { var x = el('span'); x.innerHTML = s; return x; }
  function fillLine(id) {
    var x = LINE[id], s = SECTION[x.s], st = levels().m[id], n = notesOn(id).length;
    item('ID', id);
    item('For', x.y2 ? 'Year 2 only' : 'Year 1 and Year 2');
    item('Section', html(s.num + ' ' + s.name));
    item('Topics', html(x.t.map(function (t) { return TOPIC[t].name; }).join('<br>') || 'none yet'));
    item(NAME, LEVELS[st ? st.l : 0] + (st ? ', ' + ago(st.d) : ''));
    var a = el('a', '', n ? 'Open my notes (' + n + ')' : 'Start a note'); a.href = 'notebook.html#c:' + id; item('Notes', a);
    var sw = el('span', 'seg'); [['en', 'En'], ['ar', 'ع'], ['tr', 'Tr']].forEach(function (f) {
      var bt = el('button', '', f[1]); bt.type = 'button';
      bt.addEventListener('click', function () { var r = popBtn.closest('.row'); r.classList.remove('lf-ar', 'lf-en', 'lf-tr'); r.classList.add('lf-' + f[0]); });
      sw.appendChild(bt);
    });
    item('This line in', sw);
  }
  function fillTerm(g) {
    var x = parse(g.dataset.info, {}), st = levels().m[x.id];
    item('ID', x.id); item('For', x.y2 ? 'Year 2 only' : 'Year 1 and Year 2'); item('Transliteration', x.tr);
    if (x.en) item('English', x.en);
    if (x.pl) item('Plural', x.pl);
    item(NAME, LEVELS[st ? st.l : 0] + (st ? ', ' + ago(st.d) : ''));
  }
  function fillCount(btn) {
    var c = btn.dataset.c.split(',').map(Number), n = +btn.dataset.n;
    [0, 1, 2, 3].forEach(function (l) {
      var v = el('span', 'cnt'); v.innerHTML = '<span class="lv show" data-l="' + l + '">' + BAR + '</span>';
      v.appendChild(document.createTextNode(c[l] + ' of ' + n + ' (' + Math.round(100 * c[l] / n) + '%)')); item(LEVELS[l], v);
    });
  }
  function refillPop() {
    if (pop.hidden || !popBtn || !document.body.contains(popBtn)) { pop.hidden = true; return; }
    pop.textContent = ''; var r = popBtn.closest('.row'), g = popBtn.closest('.g');
    if (popBtn.dataset.c) fillCount(popBtn); else if (g) fillTerm(g); else if (r) fillLine(r.dataset.id);
  }
  function closePop() { if (!pop.hidden) { pop.hidden = true; if (popBtn) popBtn.setAttribute('aria-expanded', 'false'); } }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('.inf') : null;
    if (t) {
      e.preventDefault(); e.stopPropagation();   // inside a heading, the i does not open the lines
      var was = !pop.hidden && popBtn === t; closePop(); if (was) return;
      popBtn = t; pop.hidden = false; refillPop(); t.setAttribute('aria-expanded', 'true');
      var r = t.getBoundingClientRect(), w = pop.offsetWidth;
      pop.style.top = (r.bottom + window.scrollY + 6) + 'px';
      pop.style.left = Math.max(8, Math.min(r.right + window.scrollX - w, window.scrollX + document.documentElement.clientWidth - w - 8)) + 'px';
      return;
    }
    if (!pop.contains(e.target)) closePop();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closePop(); });

  // ---------- the folds of the criteria and the glossary: a heading with a count and a bar, opened by a click, remembered
  function meter(box, ids) {   // box: the heading that holds the count; ids: the lines or terms it counts
    var m = levels().m, c = [0, 0, 0, 0], n = ids.length;
    ids.forEach(function (i) { c[m[i] ? m[i].l : 0]++; });
    var f = box.querySelector('.frac'), ib = box.querySelector('.inf'), bar = box.querySelector('.pr-b');
    f.textContent = c[3] + ' / ' + n; ib.dataset.c = c.join(','); ib.dataset.n = n;
    ib.setAttribute('aria-label', 'How these ' + n + ' are marked');
    all('i', bar).forEach(function (s) { var l = +s.className.slice(1); s.style.width = (n ? 100 * c[l] / n : 0) + '%'; });
  }
  var opened = parse(load('sarf_open'), {}) || {};
  all('.fold').forEach(function (f) {
    var o = !!opened[f.dataset.k]; f.classList.toggle('open', o); f.querySelector('.opener').setAttribute('aria-expanded', String(o));
    // a click anywhere on the heading opens it, except on the i
    f.querySelector('.fhead').addEventListener('click', function (e) { if (!e.target.closest('.opener, .inf')) f.querySelector('.opener').click(); });
  });
  var y1 = function () { return b.classList.contains('lines-y1'); };

  // ---------- criteria page: views, filters, and a count and bar on every heading
  if ($('view-home')) {
    var setView = function (v) { $('view-home').hidden = v !== 'home'; $('view-topic').hidden = v !== 'topic'; choose(document.querySelector('.views'), v); filter(); };
    all('.views button').forEach(function (x) { x.dataset.v = x.dataset.view; x.addEventListener('click', function () { save('sarf_view', x.dataset.v); setView(x.dataset.v); }); });
    var pOK = picks('p', 'sarf_filter_p', function () { refresh(); });
    var lOK = picks('l', 'sarf_filter_l', function () { refresh(); });
    // a line is counted when its priority is chosen in Show only and it is for this year; how it is marked does not matter
    var counts = function (r) { return pOK(r.dataset.p === '4' ? 3 : +r.dataset.p) && !(y1() && r.classList.contains('y2row')); };
    var ids = function (box) { return all('.row', box).filter(counts).map(function (r) { return r.dataset.id; }); };
    var filter = function () {
      var m = levels().m, any = false;
      ['view-home', 'view-topic'].forEach(function (v) {
        var box = $(v);
        all('.row', box).forEach(function (r) {
          var l = m[r.dataset.id] ? m[r.dataset.id].l : 0;
          var ok = pOK(r.dataset.p === '4' ? 3 : +r.dataset.p) && lOK(l) && !(y1() && r.classList.contains('y2row'));
          r.classList.toggle('off', !ok); if (ok && !box.hidden) any = true;
        });
        // a heading shows only if a line under it shows
        all('.fold', box).forEach(function (h) { h.classList.toggle('off', !h.querySelector('.row:not(.off)')); });
        all('.fold', box).forEach(function (f) { meter(f.querySelector('.fhead'), ids(f)); });
      });
      meter(document.querySelector('.ovr[data-k="all"] .fhead'), ids($('view-home')));
      $('none').hidden = any;
    };
    var fp = $('fpanel'), ft = $('ftoggle');
    if (fp && ft) {
      var home = 0, ticking = false;   // where the Show only rows sit in the page when not pinned
      var check = function () {
        ticking = false;
        var top = (nav ? nav.offsetHeight : 0) + 48;
        if (!b.classList.contains('fopen')) home = fp.getBoundingClientRect().top + window.scrollY;
        var gone = window.scrollY + top > home + fp.offsetHeight;   // scrolled past them
        if (!gone && b.classList.contains('fopen')) { b.classList.remove('fopen'); ft.setAttribute('aria-expanded', 'false'); ft.classList.remove('on'); }
        ft.hidden = !gone;
      };
      window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
      window.addEventListener('resize', check); check();
      ft.addEventListener('click', function () {
        var o = b.classList.toggle('fopen'); ft.setAttribute('aria-expanded', String(o)); ft.classList.toggle('on', o);
      });
    }
    // the key: a small panel under its button, out of the way until it is wanted
    var kb = $('keybtn'), kp = $('keyp');
    if (kb && kp) {
      var keyOpen = function (o) { kp.hidden = !o; kb.setAttribute('aria-expanded', String(o)); kb.classList.toggle('on', o); };
      kb.addEventListener('click', function () { keyOpen(kp.hidden); });
      document.addEventListener('click', function (e) { if (!kp.hidden && !kp.contains(e.target) && !kb.contains(e.target)) keyOpen(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !kp.hidden) { keyOpen(false); kb.focus(); } });
    }
    on('#show-all', 'click', function () {
      ['sarf_filter_p', 'sarf_filter_l'].forEach(function (k) { save(k, JSON.stringify(['3', '2', '1', '0'])); });
      location.reload();
    });
    refresh = function () { filter(); refillPop(); };
    setView(load('sarf_view') === 'topic' ? 'topic' : 'home');
  }

  // ---------- glossary, application and criteria: a click on a term, a name or a heading opens what is under it;
  // a switch opens them all, remembered
  on('.opener', 'click', function () {
    var box = this.closest('.g, .acard, .fold'), o = box.classList.toggle('open'); this.setAttribute('aria-expanded', String(o));
    if (box.classList.contains('fold')) { var k = parse(load('sarf_open'), {}) || {}; if (o) k[box.dataset.k] = 1; else delete k[box.dataset.k]; save('sarf_open', JSON.stringify(k)); }
  });
  // the glossary's definitions have their own button, apart from its folds
  var OPENS = { sarf_crit_all: 'all-open', sarf_gl_folds: 'all-open', sarf_gl_all: 'defs-open', sarf_app_all: 'all-open' };
  all('.openall').forEach(function (bt) {
    var k = bt.dataset.key, set = function (o) {
      b.classList.toggle(OPENS[k], o); bt.textContent = o ? bt.dataset.off : bt.dataset.on;
      bt.setAttribute('aria-pressed', String(o)); bt.classList.toggle('on', o);
    };
    set(load(k) === '1');
    bt.addEventListener('click', function () { var o = !b.classList.contains(OPENS[k]); save(k, o ? '1' : '0'); set(o); });
  });
  if ($('gfind')) {
    $('gfind').addEventListener('input', function () {
      var q = this.value.trim().toLowerCase(), n = 0;
      all('.g').forEach(function (g) { var ok = g.dataset.find.indexOf(q) >= 0; g.hidden = !ok; n += ok; });
      all('.gfold').forEach(function (f) { f.hidden = !f.querySelector('.g:not([hidden])'); });
      b.classList.toggle('searching', !!q);   // while searching, every tag with a match is open
      $('gnone').hidden = n > 0;
    });
    var gid = function (g) { return g.querySelector('.lv').dataset.id; };
    var counted = function (g) { return !(y1() && g.classList.contains('y2row')); };
    refresh = function () {
      all('.gfold').forEach(function (f) { meter(f.querySelector('.fhead'), all('.g', f).filter(counted).map(gid)); });
      var seen = {}; all('.g').filter(counted).forEach(function (g) { seen[gid(g)] = 1; });
      meter(document.querySelector('.ovr[data-k="gl"] .fhead'), Object.keys(seen));
      refillPop();
    };
    refresh();
  }

  paint();
  if (!$('nb-note')) return;

  // ---------- notebook
  function readNotes() {
    var s = parse(load('sarf_notebook'), null);
    if (s && s.v === 1 && Array.isArray(s.notes)) return s;
    var old = Array.isArray(s) ? s : [];   // the first layout: [ { id, c: [IDs], t: text, d } ]
    s = { v: 1, notes: old.map(function (n) { return { id: String(n.id), title: '', text: n.t || '', links: (n.c || []).map(function (r) { return { t: 'c', r: r }; }), made: n.d || n.id, changed: n.d || n.id }; }) };
    save('sarf_notebook', JSON.stringify(s)); return s;
  }
  function change(id, fn) {   // read the latest, change one note, save
    var s = readNotes(), n = s.notes.filter(function (x) { return x.id === id; })[0];
    if (!n) return null;
    fn(n, s); n.changed = Date.now();
    if (!save('sarf_notebook', JSON.stringify(s))) { say('Your notes could not be saved in this browser.'); return n; }
    $('nb-saved').textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return n;
  }
  function create(links) {
    var s = readNotes(), n = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '', text: '', links: links || [], made: Date.now(), changed: Date.now() };
    s.notes.push(n); save('sarf_notebook', JSON.stringify(s)); return n;
  }
  function remove(id) { var s = readNotes(); s.notes = s.notes.filter(function (x) { return x.id !== id; }); save('sarf_notebook', JSON.stringify(s)); }
  function say(t) { $('nb-msg').textContent = t; }
  var curId = null, how = load('sarf_nb_order') === 'date' ? 'date' : 'criterion';
  function cur() { return readNotes().notes.filter(function (x) { return x.id === curId; })[0] || null; }
  function linkPos(k) {
    if (k.t === 'c') return LINE[k.r] ? LINE[k.r].pos : 1e6;
    if (k.t === 's') { var s = SECTION[k.r]; return s ? DATA.lines.filter(function (x) { return x.s === k.r; }).reduce(function (a, x) { return Math.min(a, x.pos); }, 1e6) : 1e6; }
    return DATA.lines.filter(function (x) { return x.t.indexOf(+k.r) >= 0; }).reduce(function (a, x) { return Math.min(a, x.pos); }, 1e6);
  }
  function pos(n) { return Math.min.apply(null, n.links.map(linkPos).concat([1e6])); }
  function sorted(list) { return list.slice().sort(function (x, y) { return how === 'date' ? y.changed - x.changed : pos(x) - pos(y) || x.links.length - y.links.length || x.made - y.made; }); }
  function linkName(k, short) {
    if (k.t === 'c') return LINE[k.r] ? LINE[k.r].num : k.r;
    if (k.t === 't') return TOPIC[k.r] ? (short ? 'Topic: ' + plain(TOPIC[k.r].name) : 'Topic: ' + TOPIC[k.r].name) : 'A topic no longer on the list';
    return SECTION[k.r] ? (short ? 'Section ' + SECTION[k.r].num : 'Section ' + SECTION[k.r].num + ' ' + SECTION[k.r].name) : 'A section no longer on the list';
  }
  function sameLinks(a, b2) { var f = function (l) { return l.map(function (k) { return k.t + k.r; }).sort().join(); }; return a.length && f(a) === f(b2); }
  function draw() {
    choose(document.querySelector('.nb-bar'), how);
    var q = $('nb-search').value.trim().toLowerCase(), notes = readNotes().notes;
    notes = notes.filter(function (n) { return n.id === curId || n.title.trim() || n.text.trim() || n.links.length; });   // empty notes are dropped
    var list = $('nb-list'); list.textContent = '';
    sorted(notes).forEach(function (n) {
      if (q && (n.title + ' ' + n.text).toLowerCase().indexOf(q) < 0) return;
      var d = el('button', 'nb-it' + (n.id === curId ? ' on' : '')); d.type = 'button';
      d.appendChild(el('b', '', n.title.trim() || n.links.map(function (k) { return linkName(k, true); }).join(' + ') || 'No link yet'));
      d.appendChild(el('span', '', n.text.trim().slice(0, 50) || 'Empty note'));
      d.addEventListener('click', function () { curId = n.id; say(''); draw(); });
      list.appendChild(d);
    });
    var n = cur(); $('nb-note').hidden = !n;
    if (!n) return;
    var box = $('nb-links'); box.textContent = '';
    n.links.forEach(function (k) {
      var d = el('div', 'nb-cr'), s = el('span', 'nb-txt');
      if (k.t === 'c' && LINE[k.r]) {
        var lvb = el('button', 'lv'); lvb.type = 'button'; lvb.dataset.id = k.r; lvb.innerHTML = BAR; d.appendChild(lvb);
        s.innerHTML = '<span class="num">' + LINE[k.r].num + '</span>' + LINE[k.r].html + ' <span class="id">' + k.r + '</span>';
      } else if (k.t === 't' || k.t === 's') {
        var ids = DATA.lines.filter(function (x) { return k.t === 't' ? x.t.indexOf(+k.r) >= 0 : x.s === k.r; }).map(function (x) { return x.id; });
        s.innerHTML = '<b>' + linkName(k) + '</b> <span class="sub">' + ids.filter(function (i) { return lv(i) === 3; }).length + ' of ' + ids.length + ' known</span>';
      } else s.textContent = 'A criterion no longer on the list (' + k.r + ')';
      d.appendChild(s);
      if (k.t === 'c' && LINE[k.r]) {
        var qt = el('button', '', 'Quote'); qt.type = 'button';
        qt.addEventListener('click', function () {
          var t = $('nb-body'), a = t.selectionStart, line = (a && t.value[a - 1] !== '\n' ? '\n' : '') + LINE[k.r].num + ' ' + plain(LINE[k.r].html) + ' (' + k.r + ')\n';
          t.value = t.value.slice(0, a) + line + t.value.slice(t.selectionEnd); t.selectionStart = t.selectionEnd = a + line.length; t.focus();
          change(curId, function (x) { x.text = t.value; });
        });
        d.appendChild(qt);
      }
      var x = el('button', '', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Remove this link');
      x.addEventListener('click', function () { change(curId, function (m) { m.links = m.links.filter(function (y) { return !(y.t === k.t && y.r === k.r); }); }); draw(); });
      d.appendChild(x); box.appendChild(d);
    });
    if (document.activeElement !== $('nb-body')) $('nb-body').value = n.text;
    if (document.activeElement !== $('nb-title')) $('nb-title').value = n.title;
    paint();
  }
  function addLink(k) {
    var n = cur(); if (!n) return;
    if (!n.links.some(function (y) { return y.t === k.t && y.r === k.r; })) {
      var next = n.links.concat([k]), twin = readNotes().notes.filter(function (o) { return o.id !== n.id && sameLinks(o.links, next); })[0];
      if (twin && !n.text.trim() && !n.title.trim()) { remove(n.id); curId = twin.id; say('You already have a note on this, so it has been opened.'); }
      else { change(n.id, function (m) { m.links.push(k); }); say(twin ? 'You also have another note with exactly these links.' : ''); }
    }
    $('nb-find').value = ''; $('nb-hits').textContent = ''; draw();
  }
  $('nb-find').addEventListener('input', function () {
    var q = this.value.trim().toLowerCase(), hits = $('nb-hits'); hits.textContent = ''; say('');
    if (!q) return;
    var f = [], qs = q.replace(/^section\s+/, '');
    DATA.topics.forEach(function (t) { if (plain(t.name).toLowerCase().indexOf(q) >= 0 || t.name.toLowerCase().indexOf(q) >= 0 || ('topic ' + t.id) === q) f.push({ k: { t: 't', r: t.id }, html: '<b>Topic</b> ' + t.name }); });
    DATA.sections.forEach(function (s) { if (s.num === qs || (s.num + ' ' + plain(s.name)).toLowerCase().indexOf(qs) >= 0) f.push({ k: { t: 's', r: s.code }, html: '<b>Section ' + s.num + '</b> ' + s.name }); });
    DATA.lines.filter(function (x) { return x.find.indexOf(q) >= 0; }).sort(function (x, y) { return (y.id === q || y.num === q) - (x.id === q || x.num === q) || x.pos - y.pos; })
      .forEach(function (x) { f.push({ k: { t: 'c', r: x.id }, html: '<span class="num">' + x.num + '</span>' + x.html }); });
    f.slice(0, 10).forEach(function (h) { var d = el('button', 'nb-hit'); d.type = 'button'; d.innerHTML = h.html; d.addEventListener('click', function () { addLink(h.k); }); hits.appendChild(d); });
    if (!f.length) say('Nothing found.'); else if (f.length > 10) say('The first 10 of ' + f.length + '. Write more to narrow it.');
  });
  $('nb-find').addEventListener('keydown', function (e) { if (e.key === 'Enter' && $('nb-hits').firstChild) { e.preventDefault(); $('nb-hits').firstChild.click(); } });
  $('nb-body').addEventListener('input', function () { var v = this.value; change(curId, function (n) { n.text = v; }); });
  $('nb-title').addEventListener('input', function () { var v = this.value; change(curId, function (n) { n.title = v; }); });
  $('nb-body').addEventListener('change', draw); $('nb-title').addEventListener('change', draw);
  $('nb-search').addEventListener('input', draw);
  $('nb-new').addEventListener('click', function () { curId = create().id; say(''); draw(); $('nb-find').focus(); });
  $('nb-del').addEventListener('click', function () {
    var n = cur(); if (!n) return;
    function gone() { remove(n.id); curId = null; draw(); }
    if (n.text.trim() || n.title.trim() || n.links.length) ask(this, 'Delete this note? This cannot be undone.', 'Delete', gone); else gone();
  });
  all('[data-order]').forEach(function (x) { x.dataset.v = x.dataset.order; x.addEventListener('click', function () { how = x.dataset.v; save('sarf_nb_order', how); draw(); }); });
  window.addEventListener('storage', function (e) { if (e.key === 'sarf_notebook') draw(); });
  refresh = function () { if ($('nb-links')) draw(); };

  // print the whole notebook
  function buildPrint() {
    var p = $('nb-print'); p.textContent = ''; p.appendChild(el('h1', '', 'My Sarf notebook'));
    sorted(readNotes().notes).forEach(function (n) {
      if (!n.text.trim() && !n.title.trim() && !n.links.length) return;
      var d = el('div', 'np');
      if (n.title.trim()) d.appendChild(el('h3', '', n.title));
      n.links.forEach(function (k) {
        var c = el('div', 'np-c');
        if (k.t === 'c' && LINE[k.r]) c.innerHTML = '<span class="num">' + LINE[k.r].num + '</span>' + LINE[k.r].html + ' <span class="id">' + k.r + '</span> · ' + LEVELS[lv(k.r)];
        else c.innerHTML = linkName(k);
        d.appendChild(c);
      });
      d.appendChild(el('div', 'np-t', n.text)); p.appendChild(d);
    });
  }
  window.addEventListener('beforeprint', buildPrint);
  $('nb-pdf').addEventListener('click', function () { buildPrint(); window.print(); });

  // backup: one file with the notes and the levels; restore adds what is not there and keeps the newer of two copies
  $('nb-down').addEventListener('click', function () {
    var data = { app: 'sarf-notebook', v: 1, saved: new Date().toISOString(), notebook: readNotes(), levels: levels() };
    var a = el('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' }));
    a.download = 'sarf-notebook-' + new Date().toISOString().slice(0, 10) + '.json'; b.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    say('Backup downloaded. Keep the file somewhere safe; Restore backup reads it back.');
  });
  $('nb-up').addEventListener('change', function () {
    var f = this.files[0]; this.value = ''; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var x = parse(r.result, null);
      if (!x || x.app !== 'sarf-notebook' || !x.notebook || !Array.isArray(x.notebook.notes) || !x.levels || !x.levels.m) { say('That file is not a backup of this notebook.'); return; }
      if (x.v > 1) { say('That backup is from a newer version of this site. Reload the page and try again.'); return; }
      var s = readNotes(), have = {}, added = 0, updated = 0;
      s.notes.forEach(function (n) { have[n.id] = n; });
      x.notebook.notes.forEach(function (n) {
        if (!n || !n.id || !Array.isArray(n.links)) return;
        n = { id: String(n.id), title: String(n.title || ''), text: String(n.text || ''), made: +n.made || Date.now(), changed: +n.changed || Date.now(),
              links: n.links.filter(function (k) { return k && /^[cts]$/.test(k.t); }).map(function (k) { return { t: k.t, r: k.t === 't' ? +k.r : String(k.r) }; }) };
        if (!have[n.id]) { s.notes.push(n); added++; }
        else if (n.changed > have[n.id].changed) { s.notes[s.notes.indexOf(have[n.id])] = n; updated++; }
      });
      var L = levels(), lc = 0;
      Object.keys(x.levels.m).forEach(function (k) {
        var v = x.levels.m[k]; if (!v || !(v.l >= 0 && v.l <= 3)) return;
        if (!L.m[k] || v.d > L.m[k].d) { L.m[k] = { l: v.l, d: +v.d || Date.now() }; lc++; }
      });
      save('sarf_notebook', JSON.stringify(s)); save('sarf_levels', JSON.stringify(L));
      say('Restored: ' + added + ' notes added, ' + updated + ' updated, ' + lc + ' levels taken from the backup.'); draw(); paint();
    };
    r.readAsText(f);
  });

  // open the note for a criterion, topic or section from a link such as notebook.html#c:0396
  var h = decodeURIComponent(location.hash.slice(1)), m2 = h.match(/^(?:([cts]):)?(.+)$/), want = null;
  if (m2) { var t = m2[1] || 'c', r = t === 't' ? +m2[2] : m2[2]; if ((t === 'c' && LINE[r]) || (t === 't' && TOPIC[r]) || (t === 's' && SECTION[r])) want = { t: t, r: r }; }
  if (want) {
    var found = readNotes().notes.filter(function (n) { return n.links.length === 1 && n.links[0].t === want.t && n.links[0].r === want.r; })[0];
    curId = (found || create([want])).id;
    if (history.replaceState) history.replaceState(null, '', location.pathname);
  } else { var first = sorted(readNotes().notes)[0]; curId = first ? first.id : null; }
  draw();
})();
