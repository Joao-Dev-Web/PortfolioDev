(() => {
  const KEY = 'portfolio-dev-v1';
  const MEDIA = '<figure class="media"><span class="ph"><svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg><span>Inserir imagem</span></span><button class="rm" aria-label="Remover imagem">×</button></figure>';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const track = $('#track'), pages = $$('.page'), pager = $('#pager');
  const LOCK = 1100;           // trava durante a animação (ms) = --dur
  let cur = 0, locked = false, editing = false, acc = 0, accTimer;

  /* ---------- persistência ---------- */
  const factory = pages.map(p => ({ title: $('[data-title]', p).textContent, strip: $('.strip', p).innerHTML }));
  const isAdmin = location.pathname.replace(/\/$/, '') === '/admin';
  let pass = sessionStorage.getItem('adm') || '';
  if (isAdmin) document.body.classList.add('admin');
  let settings = {};
  const FONTS = { alegreya: "'Alegreya',Georgia,serif", georgia: "Georgia,'Times New Roman',serif", sans: "system-ui,'Segoe UI',Arial,sans-serif", mono: "ui-monospace,Consolas,monospace" };
  const HEX = /^#[0-9a-f]{6}$/i, KEYS = ['accent', 'g1', 'g2', 'g3'];
  const applySettings = () => {
    let css = '';
    for (const t of ['dark', 'light']) {
      const d = Object.entries(settings[t] || {}).filter(([k, v]) => KEYS.includes(k) && HEX.test(v)).map(([k, v]) => `--${k}:${v}`).join(';');
      if (d) css += (t === 'dark' ? ':root' : ':root[data-theme="light"]') + '{' + d + '}\n';
    }
    if (Object.hasOwn(FONTS, settings.font)) css += 'html,body{font-family:' + FONTS[settings.font] + '}';
    let el = $('#custom'); if (!el) { el = document.createElement('style'); el.id = 'custom'; document.head.appendChild(el); }
    el.textContent = css;
  };
  const snapshot = () => pages.map(p => {
    const c = $('.strip', p).cloneNode(true);
    $$('[contenteditable]', c).forEach(el => el.removeAttribute('contenteditable'));
    return { title: $('[data-title]', p).textContent, strip: c.innerHTML };
  });
  const save = async () => {
    if (!isAdmin || !pass) return;
    try {
      const r = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-password': pass }, body: JSON.stringify({ pages: snapshot(), settings }) });
      flash(r.ok ? 'Salvo no site' : r.status === 401 ? 'Senha incorreta' : 'Erro ao salvar');
    } catch (e) { flash('Servidor indisponível'); }
  };
  const load = async () => {
    try {
      const r = await fetch('content.json', { cache: 'no-store' });
      const j = r.ok ? await r.json() : null;
      const d = j && (Array.isArray(j) ? j : j.pages);
      if (j && !Array.isArray(j) && j.settings) { settings = j.settings; applySettings(); }
      if (d && d.length === pages.length) d.forEach((x, i) => { $('[data-title]', pages[i]).textContent = x.title; $('.strip', pages[i]).innerHTML = x.strip; });
    } catch (e) {}
  };
  let ft; const flash = m => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(ft); ft = setTimeout(() => t.classList.remove('show'), 1400); };

  /* ---------- carrossel principal ---------- */
  pages.forEach((p, i) => {
    const b = document.createElement('button');
    b.textContent = p.dataset.name; b.onclick = () => goPage(i); pager.appendChild(b);
  });
  function goPage(i) {
    i = Math.max(0, Math.min(pages.length - 1, i));
    if (i === cur || locked) return;
    cur = i; locked = true; setTimeout(() => locked = false, LOCK);
    render();
  }
  function render() {
    track.style.transform = `translate3d(${-cur * 100}vw,0,0)`;
    $$('button', pager).forEach((b, i) => b.classList.toggle('on', i === cur));
    pages.forEach((p, i) => p.toggleAttribute('inert', i !== cur));
    pages.forEach((p, i) => $$('.slide', p).forEach((s, j) => s.classList.toggle('on', i === cur && j === p._i)));
  }

  /* scroll do mouse -> troca de aba (acumula o delta p/ suportar trackpad) */
  const atEdge = (el, dir) => !el || el.scrollHeight <= el.clientHeight + 4 || (dir > 0 ? el.scrollTop + el.clientHeight >= el.scrollHeight - 4 : el.scrollTop <= 4);
  let hold = 0;
  addEventListener('wheel', e => {
    if (e.ctrlKey || (e.target.closest && e.target.closest('#panel'))) return;
    const sl = e.target.closest && e.target.closest('.slide');
    if (sl && !atEdge(sl, Math.sign(e.deltaY))) { hold = Date.now(); return; }
    e.preventDefault();
    if (locked || Date.now() - hold < 400) return;
    const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    acc += d; clearTimeout(accTimer); accTimer = setTimeout(() => acc = 0, 160);
    if (Math.abs(acc) > 40) { goPage(cur + Math.sign(acc)); acc = 0; }
  }, { passive: false });

  addEventListener('keydown', e => {
    if (editing && (e.target.isContentEditable || e.target.closest('#panel'))) return;
    if (e.key === 'ArrowDown' || e.key === 'PageDown') goPage(cur + 1);
    if (e.key === 'ArrowUp' || e.key === 'PageUp') goPage(cur - 1);
    if (e.key === 'ArrowRight') step(pages[cur], 1);
    if (e.key === 'ArrowLeft') step(pages[cur], -1);
  });

  /* toque: vertical = aba, horizontal = slide */
  let tx, ty, ts, te = {};
  addEventListener('touchstart', e => {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    ts = e.target.closest && e.target.closest('.slide'); te = { up: atEdge(ts, -1), down: atEdge(ts, 1) };
  }, { passive: true });
  addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) { if (dy < 0 ? te.down : te.up) goPage(cur + (dy < 0 ? 1 : -1)); }
    else if (Math.abs(dx) > 60) step(pages[cur], dx < 0 ? 1 : -1);
  }, { passive: true });

  /* ---------- sub-carrosséis ---------- */
  function sync(p) {
    const strip = $('.strip', p), slides = $$('.slide', p), n = slides.length;
    p._i = Math.max(0, Math.min(n - 1, p._i || 0));
    strip.style.transform = `translate3d(${-p._i * 100}%,0,0)`;
    const dots = $('.dots', p); dots.innerHTML = '';
    slides.forEach((s, j) => {
      s.classList.toggle('on', pages[cur] === p && j === p._i);
      s.toggleAttribute('inert', j !== p._i);
      const d = document.createElement('button');
      d.className = 'dot' + (j === p._i ? ' on' : ''); d.setAttribute('aria-label', 'Slide ' + (j + 1));
      d.onclick = () => { p._i = j; sync(p); }; dots.appendChild(d);
    });
  }
  function step(p, dir) { p._i = Math.max(0, Math.min($$('.slide', p).length - 1, (p._i || 0) + dir)); sync(p); }

  pages.forEach(p => {
    p._i = 0;
    $('.prev', p).onclick = () => step(p, -1);
    $('.next', p).onclick = () => step(p, 1);
    $('.add', p).onclick = () => {
      const a = document.createElement('article'); a.className = 'slide';
      a.innerHTML = '<div class="txt"><h3>Novo slide</h3><p>Clique em Editar e escreva aqui.</p></div>' + MEDIA;
      $('.strip', p).appendChild(a); p._i = $$('.slide', p).length - 1; setEditable(); sync(p); save();
    };
    $('.del', p).onclick = () => {
      const s = $$('.slide', p); if (s.length < 2) return flash('Mantenha ao menos um slide');
      s[p._i].remove(); sync(p); save();
    };
  });

  /* ---------- modo edição ---------- */
  const EDIT_SEL = '.slide h3,.slide p,.slide li b,.slide li span,.slide li span a,.slide a,[data-title]';
  function setEditable() { $$(EDIT_SEL).forEach(el => editing ? el.setAttribute('contenteditable', 'true') : el.removeAttribute('contenteditable')); }
  $('#btnEdit').onclick = async e => {
    if (!isAdmin) return;
    if (!editing && !pass) {
      const v = prompt('Senha de edição:'); if (!v) return;
      try { const r = await fetch('/api/login', { method: 'POST', headers: { 'x-admin-password': v } }); if (!r.ok) return flash('Senha incorreta'); }
      catch (err) { return flash('Servidor indisponível'); }
      pass = v; sessionStorage.setItem('adm', v);
    }
    editing = !editing; document.body.classList.toggle('editing', editing);
    e.target.classList.toggle('on', editing); e.target.setAttribute('aria-pressed', editing);
    e.target.textContent = editing ? 'Concluir' : 'Editar';
    $('#btnReset').style.display = editing ? 'inline-block' : 'none';
    setEditable(); if (!editing) save();
  };
  $('#btnReset').onclick = () => {
    if (!confirm('Restaurar o conteúdo original?')) return;
    try { localStorage.removeItem(KEY); } catch (e) {}
    factory.forEach((x, i) => { $('[data-title]', pages[i]).textContent = x.title; $('.strip', pages[i]).innerHTML = x.strip; pages[i]._i = 0; });
    setEditable(); pages.forEach(sync); settings = {}; applySettings(); flash('Conteúdo restaurado'); save();
  };
  let st; document.addEventListener('input', () => { clearTimeout(st); st = setTimeout(save, 600); });
  /* links não navegam enquanto edita */
  document.addEventListener('click', e => { if (editing && e.target.closest('a')) e.preventDefault(); });

  /* tema */
  $('#theme').onclick = () => {
    const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem(KEY + '-theme', t); } catch (e) {}
  };
  /* imagens: clique no quadro no modo edição */
  const pick = document.createElement('input'); pick.type = 'file'; pick.accept = 'image/*'; let target;
  document.addEventListener('click', e => {
    if (!editing) return;
    const rm = e.target.closest('.rm');
    if (rm) { const f = rm.closest('.media'); const im = $('img', f); if (im) im.remove(); f.classList.remove('filled'); save(); return; }
    const m = e.target.closest('.media'); if (m) { target = m; pick.click(); }
  });
  pick.onchange = () => {
    const f = pick.files[0]; if (!f || !target) return;
    const r = new FileReader();
    r.onload = () => { const im = new Image(); im.onload = () => {
      const k = Math.min(1, 1100 / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = im.width * k; c.height = im.height * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      let o = $('img', target); if (!o) { o = document.createElement('img'); o.alt = ''; target.prepend(o); }
      c.toBlob(async b => {
        try {
          const r = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'x-admin-password': pass }, body: b });
          if (!r.ok) throw 0; o.src = (await r.json()).url; target.classList.add('filled'); save();
        } catch (err) { if (!o.getAttribute('src')) o.remove(); flash('Falha ao enviar a imagem'); }
      }, 'image/jpeg', .82);
    }; im.src = r.result; };
    r.readAsDataURL(f); pick.value = '';
  };
  /* brilho que segue o mouse */
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const m = { x: 70, y: 25, tx: 70, ty: 25 };
    addEventListener('pointermove', e => { m.tx = e.clientX / innerWidth * 100; m.ty = e.clientY / innerHeight * 100; });
    (function loop() {
      m.x += (m.tx - m.x) * .04; m.y += (m.ty - m.y) * .04;
      pages[cur].style.setProperty('--mx', m.x + '%'); pages[cur].style.setProperty('--my', m.y + '%');
      requestAnimationFrame(loop);
    })();
  }

  /* ---------- painel Personalizar (só em /admin) ---------- */
  if (isAdmin) {
    const root = document.documentElement, panel = document.createElement('div'); panel.id = 'panel';
    panel.innerHTML = `<details><summary>Personalizar</summary>
      <div class="row"><button data-c="bold" title="Negrito"><b>B</b></button><button data-c="italic" title="Itálico"><i>I</i></button><button data-c="link">Link</button></div>
      <div class="row"><button data-add="p">+ Texto</button><button data-add="li">+ Item</button><button data-add="a">+ Link</button><button data-del="1">Apagar bloco</button></div>
      <label>Layout<select id="pLayout"><option value="right">Imagem à direita</option><option value="left">Imagem à esquerda</option><option value="full">Imagem no topo</option><option value="text">Só texto</option></select></label>
      <label>Alinhar<select id="pAlign"><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
      <label>Altura da imagem<input type="range" id="pImgH" min="20" max="80"></label>
      <label>Largura da imagem<input type="range" id="pImgW" min="25" max="65"></label>
      <label>Posição da foto<input type="range" id="pImgY" min="0" max="100"></label>
      <label>Ajuste<select id="pFit"><option value="cover">Preencher</option><option value="contain">Mostrar inteira</option></select></label>
      <div class="row"><button data-mv="-1">◀ Mover slide</button><button data-mv="1">Mover slide ▶</button></div>
      <label>Destaque<input type="color" data-k="accent"></label><label>Gradiente 1<input type="color" data-k="g1"></label>
      <label>Gradiente 2<input type="color" data-k="g2"></label><label>Gradiente 3<input type="color" data-k="g3"></label>
      <label>Fonte<select id="pFont"><option value="alegreya">Alegreya</option><option value="georgia">Georgia</option><option value="sans">Sans-serif</option><option value="mono">Monoespaçada</option></select></label>
      <button id="pReset">Redefinir cores deste tema e fonte</button></details>`;
    document.body.appendChild(panel);
    const curSlide = () => $$('.slide', pages[cur])[pages[cur]._i];
    const med = () => $('.media', curSlide()), g = (el, p, d) => parseFloat((el && el.style.getPropertyValue(p)) || '') || d;
    const hex = v => v[0] === '#' ? v : '#' + (v.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
    const refresh = () => {
      const s = curSlide(), cs = getComputedStyle(root); if (!s) return;
      $('#pLayout').value = s.dataset.layout || 'right'; $('#pAlign').value = s.dataset.align || 'left';
      $('#pImgH').value = g(med(), '--mh', 58); $('#pImgW').value = g(s, '--iw', 45); $('#pImgY').value = g(med(), '--py', 50);
      $('#pFit').value = (med() && med().dataset.fit) || 'cover';
      $$('[data-k]', panel).forEach(i => i.value = hex(cs.getPropertyValue('--' + i.dataset.k).trim()));
      $('#pFont').value = Object.hasOwn(FONTS, settings.font) ? settings.font : 'alegreya';
    };
    ['pointerenter', 'pointerdown'].forEach(ev => panel.addEventListener(ev, refresh));
    panel.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    let cst; const later = () => { clearTimeout(cst); cst = setTimeout(save, 600); };
    $$('[data-k]', panel).forEach(i => i.oninput = () => { const t = root.dataset.theme; settings[t] = settings[t] || {}; settings[t][i.dataset.k] = i.value; applySettings(); later(); });
    $('#pFont').onchange = e => { settings.font = e.target.value; applySettings(); save(); };
    $('#pLayout').onchange = e => { curSlide().dataset.layout = e.target.value; save(); };
    $('#pAlign').onchange = e => { curSlide().dataset.align = e.target.value; save(); };
    $('#pImgH').oninput = e => { med().style.setProperty('--mh', e.target.value + 'vh'); later(); };
    $('#pImgW').oninput = e => { const s = curSlide(), v = +e.target.value; s.style.setProperty('--iw', v + 'fr'); s.style.setProperty('--tw', (100 - v) + 'fr'); later(); };
    $('#pImgY').oninput = e => { med().style.setProperty('--py', e.target.value + '%'); later(); };
    $('#pFit').onchange = e => { med().dataset.fit = e.target.value; save(); };
    $('#pReset').onclick = () => { delete settings[root.dataset.theme]; delete settings.font; applySettings(); refresh(); save(); };
    panel.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.id === 'pReset') return;
      const s = curSlide(), txt = $('.txt', s), sel = getSelection(), n = sel.anchorNode;
      const near = n && (n.nodeType === 3 ? n.parentElement : n);
      if (b.dataset.c === 'bold' || b.dataset.c === 'italic') document.execCommand(b.dataset.c);
      else if (b.dataset.c === 'link') {
        const a = near && near.closest('a');
        if (!a && sel.isCollapsed) return flash('Selecione um texto para virar link');
        const v = prompt('Endereço do link (https://...):', a ? a.getAttribute('href') : 'https://');
        if (!v) return; if (/^\s*javascript:/i.test(v)) return flash('Endereço inválido');
        if (a) a.setAttribute('href', v); else document.execCommand('createLink', false, v);
      } else if (b.dataset.add) {
        const k = b.dataset.add;
        if (k === 'li') { let ul = $('ul', txt); if (!ul) { ul = document.createElement('ul'); txt.appendChild(ul); } ul.insertAdjacentHTML('beforeend', '<li><b>Título</b><span>Descrição</span></li>'); }
        else { const p = document.createElement('p'); p.innerHTML = k === 'a' ? '<a href="#">Novo link</a>' : 'Novo texto'; txt.appendChild(p); }
        setEditable();
      } else if (b.dataset.del) {
        const blk = near && near.closest('.txt > *, .txt li');
        if (!blk || !s.contains(blk)) return flash('Clique em um texto para escolher o bloco');
        const ul = blk.tagName === 'LI' && blk.parentElement.children.length === 1 ? blk.parentElement : null;
        (ul || blk).remove();
      } else if (b.dataset.mv) {
        const dir = +b.dataset.mv, sib = dir < 0 ? s.previousElementSibling : s.nextElementSibling; if (!sib) return;
        dir < 0 ? s.parentElement.insertBefore(s, sib) : s.parentElement.insertBefore(sib, s);
        pages[cur]._i += dir; sync(pages[cur]);
      }
      save();
    });
  }

  load().then(() => { pages.forEach(sync); render(); document.body.classList.add('ready'); });
})();

