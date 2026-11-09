
'use strict';

const main = document.querySelector('#main');
const header = document.querySelector('#header');
const toast = document.querySelector('#toast');
const storeKey = 'kaoru-diary-v1';
const artwork = [
  {id:'art-orange', src:'assets/orange.jpg', name:'Orange peel in afternoon light'},
  {id:'art-drink', src:'assets/drinks.jpg', name:'Two glasses at dusk'},
  {id:'art-rain', src:'assets/rain.jpg', name:'Rain against café glass'}
];
const icons = {
  scent:'<path d="M4 9c2-4 5-4 8-1s6 3 8-1M4 14c2-4 5-4 8-1s6 3 8-1M6 18c2-2 4-2 6 0"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
  save:'<path d="M6 4h12v16l-6-4-6 4z"/>',
  saved:'<path fill="currentColor" d="M6 4h12v16l-6-4-6 4z"/>',
  cross:'<path d="m6 6 12 12M6 18 18 6"/>',
  up:'<path d="M12 19V5m-5 5 5-5 5 5"/>',
  down:'<path d="M12 5v14m-5-5 5 5 5-5"/>'
};
function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}
function esc(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}
const normalize = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
const splitLines = value => value.trim().split(/\n+/);
const route = (page, value = '') => '#' + page + (value ? '/' + encodeURIComponent(value) : '');
const byDate = (a,b) => (b.status === 'draft' ? b.updated : b.created).localeCompare(a.status === 'draft' ? a.updated : a.created);
const dateLabel = value => new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value));
const makeId = () => globalThis.crypto?.randomUUID?.() ?? 'entry-' + Date.now() + '-' + Math.random().toString(36).slice(2,9);
const now = () => new Date().toISOString();
const artworkById = id => artwork.find(item => item.id === id);
const fresh = () => ({
  id:makeId(), mode:'journal', title:'', journal:'', poem:'', prompt:'', scent:'', smell:'',
  note:'', layout:'layered', tint:'sand', crop:50, showScent:true, uploads:[], generated:[], selected:[],
  stage:'start', created:now(), updated:now(), status:'draft', version:0, parentId:''
});
function sample(id, title, created, journal, poem, scent, picture, tint) {
  return {...fresh(),id,title,created,updated:created,journal,poem,scent,selected:[picture],status:'saved',stage:'collage',tint};
}
function initialState() {
  return {scentBookmarks:[], entryBookmarks:[],entries:[
    sample('two-glasses','Two glasses at dusk','2026-11-07T21:00:00Z',
      'Mina came over. I twisted an orange peel over her drink and suddenly thought about the first evening in this apartment. The kitchen felt much smaller that day.',
      'The peel curls back.\nThis time, there are two glasses.','Orange peel','art-drink','rose'),
    sample('rain-on-glass','Rain on the glass','2026-11-04T19:00:00Z',
      'I stayed in the café after the rain started. The smell of wet pavement made its way in every time someone opened the door.',
      'Rain writes on the window\nfaster than I can read.','Wet pavement','art-rain','ash'),
    sample('first-night','First night in the apartment','2026-10-21T21:00:00Z',
      'My first night here. I sat on a moving box and peeled an orange over the only clean plate. The room was still empty, but it finally smelled like someone lived here.',
      'I peeled an orange\nin the quiet of a new room.','Orange peel','art-orange','sand')
  ]};
}
let state;
try {
  const stored = localStorage.getItem(storeKey);
  state = stored ? JSON.parse(stored) : initialState();
} catch {
  state = initialState();
}
let active = null;
let filter = 'All';
let deckEntryId = '';
let query = '';
let detailTab = '';
let detailId = '';
let toastTimer;
function message(value) {
  clearTimeout(toastTimer);
  toast.textContent = value;
  toastTimer = setTimeout(() => { toast.textContent = ''; }, 3900);
}
function persist(next = state) {
  try {
    localStorage.setItem(storeKey, JSON.stringify(next));
    state = next;
    return true;
  } catch {
    message('Couldn’t save in this browser. Try removing a large upload or freeing browser storage.');
    return false;
  }
}
function rememberDraft() {
  const existing = state.entries.find(entry => entry.id === active.id);
  if (existing || ['title','journal','poem','prompt','scent','smell','note','parentId'].some(key => active[key]?.trim()) || active.uploads.length || active.selected.length) {
    const draft = {...active, updated:now()};
    const entries = [draft, ...state.entries.filter(entry => entry.id !== draft.id)];
    return persist({...state, entries});
  }
  return true;
}
function locate() {
  const parts = location.hash.slice(1).split('/');
  let value = '';
  try { value = decodeURIComponent(parts[1] ?? ''); } catch {}
  return [parts[0] || 'diary', value];
}
function go(page, value = '') {
  const target = route(page,value);
  if (location.hash === target) render();
  else location.hash = target;
}
function itemById(id) {
  return state.entries.find(entry => entry.id === id);
}
function allScents() {
  const map = new Map();
  for (const entry of [...state.entries].sort(byDate)) {
    const key = normalize(entry.scent);
    if (!key) continue;
    const item = map.get(key) ?? {key,label:entry.scent,count:0};
    if (entry.status === 'saved' && !entry.kind) item.count++;
    map.set(key,item);
  }
  return [...map.values()].sort((a,b) => b.count-a.count || a.label.localeCompare(b.label));
}
function hasScent(key) {
  return state.scentBookmarks.includes(key);
}
function hasBookmark(id) {
  return state.entryBookmarks.includes(id);
}
function scentChip(label, extra = '') {
  return `<a class="chip ${extra}" href="${route('scent',normalize(label))}">${icon('scent')} ${esc(label)}</a>`;
}
function button(action,label,style = '',value = '',symbol = '') {
  return `<button class="btn ${style}" type="button" data-action="${action}" data-value="${esc(value)}">${symbol ? icon(symbol) : ''}${esc(label)}</button>`;
}
function iconButton(action,label,value,symbol,disabled = false) {
  return `<button class="icon-btn" type="button" data-action="${action}" data-value="${esc(value)}" aria-label="${esc(label)}" title="${esc(label)}"${disabled ? ' disabled' : ''}>${icon(symbol)}</button>`;
}
function empty(title,body,action = '') {
  return `<div class="empty"><h3>${esc(title)}</h3><p class="small">${esc(body)}</p>${action}</div>`;
}
function renderHeader(page) {
  if (page === 'diary') { header.innerHTML = ''; return; }
  header.innerHTML = `<div class="wrap bar">
    <a href="#diary" class="brand" aria-label="Kaoru home. Keep what lingers.">
      <span class="brand-mark">${icon('scent')}kaoru.</span>
      <span class="brand-slogan">Keep what lingers.</span>
    </a>
    <nav class="nav" aria-label="Main navigation">
      <a href="#diary"${page === 'diary' ? ' aria-current="page"' : ''}>Diary</a>
      <a href="#scents"${['scents','scent'].includes(page) ? ' aria-current="page"' : ''}>Scent index</a>
      <a href="#saved"${page === 'saved' ? ' aria-current="page"' : ''}>Saved</a>
    </nav>
    <div class="bar-end"><span class="eyebrow">Prototype</span>${button('new','New page','primary','','plus')}</div>
  </div>`;
}
function photos(entry) {
  return entry.selected.map(id => entry.uploads.find(file => file.id === id) || artworkById(id)).filter(Boolean);
}
function scene(entry, clickableScent = false) {
  const images = photos(entry);
  const excerpt = splitLines(entry.poem).slice(0,3).join('\n');
  const placePhoto = (item, style) => item ? `<div class="${style}"><img src="${esc(item.src)}" alt="${esc(item.name)}"></div>` : '';
  return `<div class="scene-art layout-${entry.layout} tint-${entry.tint} ${excerpt ? 'has-poem' : ''}" style="--crop:${Number(entry.crop)}%">
    ${images[0] ? placePhoto(images[0],'main-photo') : `<div class="blank-art" aria-hidden="true">${icon('scent')}</div>`}
    ${placePhoto(images[2],'little-photo third-photo')}${placePhoto(images[1],'little-photo')}
    ${excerpt ? `<div class="fragment">${esc(excerpt)}</div>` : ''}
    ${entry.note ? `<div class="margin-note">${esc(entry.note)}</div>` : ''}
    ${entry.scent && entry.showScent ? (clickableScent ? scentChip(entry.scent,'art-chip') : `<span class="chip art-chip">${icon('scent')} ${esc(entry.scent)}</span>`) : ''}
  </div>`;
}
function entryCard(entry) {
  const draft = entry.status === 'draft';
  const text = entry.journal || entry.poem || entry.prompt;
  const title = entry.title || 'Untitled memory';
  return `<article class="card">
    <button class="card-open" type="button" data-action="${draft ? 'resume' : 'entry'}" data-value="${esc(entry.id)}">
      ${scene({...entry,showScent:false})}
      <div class="card-info"><p class="eyebrow">${dateLabel(entry.created)} ${draft ? ' · Draft' : ''}</p>
        <h3>${esc(title)}</h3>${text ? `<p class="small">${esc(text)}</p>` : ''}
      </div>
    </button>
    <div class="card-foot">${entry.scent ? scentChip(entry.scent) : ''}
      ${draft ? '' : iconButton('bookmark',hasBookmark(entry.id) ? 'Remove bookmark' : 'Bookmark page',entry.id,hasBookmark(entry.id) ? 'saved' : 'save')}
    </div>
  </article>`;
}
const grid = list => `<div class="grid">${list.map(entryCard).join('')}</div>`;
function filteredEntries() {
  const q = normalize(query);
  const list = state.entries.filter(entry => {
    const matches = {
      All:true, Recent:true, Journal:entry.journal, Poems:entry.poem,
      Collages:entry.status==='saved' && !entry.kind
    };
    return matches[filter] && (!q || normalize([entry.title,entry.journal,entry.poem,entry.scent,entry.smell,entry.prompt].join(' ')).includes(q));
  });
  if (filter === 'Recent') {
    return list.sort((a,b) => Number(b.status === 'draft') - Number(a.status === 'draft') || b.updated.localeCompare(a.updated)).slice(0,6);
  }
  return list.sort(byDate);
}
function deckSheet(entry, slot) {
  const title = entry ? entry.title || 'Untitled memory' : 'New page +';
  const photo = entry && photos(entry)[0];
  const action = entry ? 'deck-select' : 'home-view';
  const label = entry ? 'Select ' + title : 'Start a new page';
  return `<div class="deck-sheet sheet-${slot}">
    ${photo ? `<img src="${esc(photo.src)}" alt="">` : ''}
    <button type="button" class="deck-sheet-control" data-action="${action}" data-value="${esc(entry?.id || '2')}" aria-label="${esc(label)}" title="${esc(title)}"><span>${esc(title)}</span></button>
  </div>`;
}
function canComplete(entry) {
  return entry.stage === 'collage' || Boolean(entry.poem.trim() || entry.journal.trim());
}
function frontSheet(entry) {
  if (!entry) {
    return `<article class="deck-front">
      <div class="front-caption"><h2>${query ? 'No matches' : 'Nothing here yet'}</h2></div>
      <div class="front-actions">${query ? button('clear-search','Clear search','deck-action') : button('home-view','Create a page','deck-action','2','arrow')}</div>
    </article>`;
  }
  const draft = entry.status === 'draft';
  const title = entry.title || 'Untitled memory';
  const kind = draft ? 'Draft' : entry.kind === 'journal' ? 'Journal' : entry.kind === 'poem' ? 'Poem' : 'Collage';
  return `<article class="deck-front">
    <div class="front-caption"><p>${dateLabel(entry.created)} · ${kind}</p><h2>${esc(title)}</h2></div>
    <div class="front-actions">
      ${draft ? button('resume','Continue Writing','deck-action',entry.id,'arrow') : button('entry','Open entry','deck-action',entry.id,'arrow')}
      ${draft && canComplete(entry) ? button('complete-draft','Mark as Complete','deck-action',entry.id,'arrow') : ''}
    </div>
    ${entry.scent ? scentChip(entry.scent,'front-scent') : ''}
  </article>`;
}
function renderEntries() {
  const list = filteredEntries();
  const index = Math.max(0,list.findIndex(entry => entry.id === deckEntryId));
  const front = list[index];
  deckEntryId = front?.id || '';
  const next = list.slice(index+1).concat(list.slice(0,index));
  const back = next.slice(0,3);
  if (front && !query && back.length < 3) back.push(null);
  const deck = document.querySelector('#entries');
  deck.innerHTML = `
    ${back.map((entry,i) => deckSheet(entry,i+1)).reverse().join('')}
    ${frontSheet(front)}
    ${list.length > 1 ? `<div class="deck-controls">
      ${iconButton('deck-step','Previous entry','-1','back')}
      <span aria-hidden="true">${String(index+1).padStart(2,'0')} / ${String(list.length).padStart(2,'0')}</span>
      ${iconButton('deck-step','Next entry','1','arrow')}
    </div>` : ''}
    <p class="entries-status" role="status">${front ? `Entry ${index+1} of ${list.length}. ${esc(front.title || 'Untitled memory')}.` : 'No entries to show.'}</p>`;
}
const homeViews = ['Entries','Senses','Create New'];
const senses = {
  eyes:['Eyes','What caught your eye?'],
  ears:['Ears','What could you hear?'],
  hand:['Hand','What did it feel like?'],
  nose:['Nose','What did it smell like?'],
  lips:['Lips','What did it taste like?']
};
let homeTurn = 0;
let homeSense = '';
let wheelLast = -Infinity;
let wheelDistance = 0;
let wheelUsed = false;
let swipeOrigin = null;
const homeIndex = () => ((homeTurn % homeViews.length) + homeViews.length) % homeViews.length;

function renderDiary() {
  homeTurn = 0;
  homeSense = '';
  main.innerHTML = `<section class="entries-home" aria-label="Kaoru home">
    <div class="entries-logo">
      <h1 data-node-id="18:243">Kaoru</h1>
      <p data-node-id="18:244">keep what lingers</p>
    </div>
    <div class="home-orbit">
      <div class="home-turntable">
        <section class="home-face face-entries" data-home-face="0" data-node-id="18:198" aria-label="Entries">
          <img class="entries-dot dot-bl" src="assets/entries/dot-bottom-left.svg" width="156" height="156" alt="" data-node-id="19:273">
          <img class="entries-dot dot-tr" src="assets/entries/dot-top-right.svg" width="89" height="89" alt="" data-node-id="19:274">
          <img class="entries-dot dot-br" src="assets/entries/dot-bottom-right.svg" width="170" height="170" alt="" data-node-id="19:275">
          <img class="entries-dot dot-tl" src="assets/entries/dot-top-left.svg" width="88" height="88" alt="" data-node-id="19:276">
          <nav class="entries-filters" aria-label="Filter entries">
            ${['All','Collages','Recent','Journal','Poems'].map(label => `<button type="button" data-action="filter" data-value="${label}" aria-pressed="${label === filter}">${label === 'All' ? 'ALL' : label}</button>`).join('')}
          </nav>
          <div id="entries" class="entries-deck" role="region" aria-roledescription="carousel" aria-label="Switch between diary entries" tabindex="0"></div>
        </section>
        <section class="home-face face-senses" data-home-face="1" data-node-id="18:204" aria-label="Senses" inert aria-hidden="true">
          ${Object.entries(senses).map(([id,[label]]) => `<button type="button" class="sense-tile sense-${id}" data-action="pick-sense" data-value="${id}" aria-pressed="false">${label}</button>`).join('')}
          <button type="button" class="sense-create" data-action="home-view" data-value="2">
            <img src="assets/entries/sense-circle.svg" width="141" height="141" alt="" data-node-id="18:225">
            <span>Create</span>
          </button>
          <div class="sense-caption"><span id="sense-status" role="status">Start with a sense.</span><a href="#scents">Browse scents →</a></div>
        </section>
        <section class="home-face face-create" data-home-face="2" data-node-id="18:227" aria-label="Create New" inert aria-hidden="true">
          <div class="home-create">
            ${button('new-from-sense','Create New','home-create-button')}
            <p id="create-instruction">Start with a journal, a poem, or an image.</p>
          </div>
        </section>
      </div>
    </div>
    <form id="entries-search" class="entries-search" role="search">
      <input id="search" type="search" placeholder="search for what you want...." value="${esc(query)}" aria-label="Search notes, poems, and scents">
      <button type="submit" aria-label="Search diary"><img src="assets/entries/search-arrow.svg" width="28" height="15" alt="" data-node-id="18:248"></button>
    </form>
    <div class="home-dock">
      <nav class="home-navigation" aria-label="Home views">
        ${iconButton('home-turn','Previous Home view','-1','back')}
        ${homeViews.map((label,i) => `<button type="button" class="home-view" data-action="home-view" data-value="${i}"${i === 0 ? ' aria-current="page"' : ''}>${label}</button>`).join('')}
        ${iconButton('home-turn','Next Home view','1','arrow')}
      </nav>
      <a href="#saved" class="home-saved">Saved</a>
    </div>
    <p id="home-announcement" class="entries-status" role="status"></p>
  </section>`;
  renderEntries();
}
function rotateHome(direction) {
  const turntable = document.querySelector('.home-turntable');
  if (!turntable) return;
  homeTurn += direction;
  const index = homeIndex();
  const next = document.querySelector(`.home-navigation .home-view[data-value="${index}"]`);
  if (document.activeElement?.closest('.home-face')) next?.focus({preventScroll:true});
  turntable.style.setProperty('--home-angle', `${-120 * homeTurn}deg`);
  turntable.querySelectorAll('.home-face').forEach((face,i) => {
    face.inert = i !== index;
    face.setAttribute('aria-hidden',String(i !== index));
  });
  document.querySelectorAll('.home-navigation .home-view').forEach((control,i) => {
    if (i === index) control.setAttribute('aria-current','page');
    else control.removeAttribute('aria-current');
  });
  document.querySelector('#home-announcement').textContent = homeViews[index] + ' view';
}
function selectHomeView(index) {
  const distance = (index - homeIndex() + homeViews.length) % homeViews.length;
  if (distance) rotateHome(distance === 1 ? 1 : -1);
}
function selectSense(key) {
  homeSense = homeSense === key ? '' : key;
  const prompt = senses[homeSense]?.[1];
  document.querySelectorAll('.sense-tile').forEach(tile => tile.setAttribute('aria-pressed',String(tile.dataset.value === homeSense)));
  document.querySelector('#sense-status').textContent = prompt || 'Start with a sense.';
  document.querySelector('#create-instruction').textContent = prompt || 'Start with a journal, a poem, or an image.';
}

function backLink(href,label = 'Back to diary') {
  return `<a class="btn link" href="${href}">${icon('back')} ${esc(label)}</a>`;
}
function viewTitle(tag,title,description = '') {
  return `<div class="view-title"><p class="kicker">${esc(tag)}</p><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ''}</div>`;
}
function renderIndex() {
  const scents = allScents().filter(item => item.count);
  main.innerHTML = `<div class="wrap view">${backLink('#diary')}${viewTitle('Browse by scent','Scent index','Find the pages that share a scent, even if they were made months apart.')}
    ${scents.length ? `<div class="index-grid">${scents.map(item => `<article class="index-card"><a href="${route('scent',item.key)}"><p class="eyebrow">${item.count} ${item.count === 1 ? 'scene' : 'scenes'}</p><h3>${esc(item.label)}</h3></a>${iconButton('bookmark-scent',hasScent(item.key) ? 'Remove scent bookmark' : 'Bookmark scent',item.key,hasScent(item.key) ? 'saved' : 'save')}</article>`).join('')}</div>` : empty('No scents yet','Add a scent to a page to find it here.')}
  </div>`;
}
function renderScent(key) {
  const info = allScents().find(item => item.key === key);
  const list = state.entries.filter(entry => entry.status === 'saved' && !entry.kind && normalize(entry.scent) === key).sort(byDate);
  main.innerHTML = `<div class="wrap view">${backLink('#scents','Scent index')}
    ${viewTitle('Scent thread',info?.label || key,list.length === 1 ? 'This is your first scene with this scent.' : `${list.length} scenes share this scent.`)}
    <div class="actions" style="margin-bottom:18px">${button('new-scent','Make a page with this scent','primary',info?.label || key,'plus')}${button('bookmark-scent',hasScent(key) ? 'Remove scent bookmark' : 'Bookmark scent','ghost',key,hasScent(key) ? 'saved' : 'save')}</div>
    ${list.length ? grid(list) : empty('No saved scenes','Save a collage with this scent to start a thread.')}
  </div>`;
}
function renderSaved() {
  const entries = state.entries.filter(entry => entry.status === 'saved' && hasBookmark(entry.id)).sort(byDate);
  const scents = allScents().filter(item => hasScent(item.key));
  main.innerHTML = `<div class="wrap view">${backLink('#diary')}${viewTitle('Bookmarks','Saved','Return to the pages and scents you want to keep close.')}
    ${scents.length ? `<div class="scent-ribbon" style="margin-bottom:18px"><span class="eyebrow">Saved scents</span>${scents.map(item => scentChip(item.label)).join('')}</div>` : ''}
    ${entries.length ? grid(entries) : empty('No bookmarked pages','Use the bookmark icon on a diary page to find it here.')}
  </div>`;
}
function renderDetail(id) {
  const entry = itemById(id);
  if (!entry || entry.status !== 'saved') {
    main.innerHTML = `<div class="wrap view">${backLink('#diary')}${empty('Page unavailable','Try opening this memory from your diary.')}</div>`;
    return;
  }
  if (detailId !== id) { detailId = id; detailTab = entry.kind || 'scene'; }
  const tabs = [...(entry.kind ? [] : [['scene','Scene']]),...(entry.journal ? [['journal','Journal']] : []),...(entry.poem ? [['poem','Poem']] : [])];
  const source = entry.parentId && itemById(entry.parentId);
  const contents = detailTab === 'scene'
    ? `${entry.smell ? `<p class="entry-text">${esc(entry.smell)}</p>` : '<p class="entry-text small">A page from your visual diary.</p>'}${entry.scent ? scentChip(entry.scent) : ''}`
    : `<p class="entry-text ${detailTab === 'poem' ? 'poetry' : ''}">${esc(entry[detailTab])}</p>`;
  main.innerHTML = `<div class="wrap view">${backLink('#diary')}
    ${viewTitle(dateLabel(entry.created),entry.title || 'Untitled memory')}
    <div class="detail-grid">${scene(entry,true)}
      <section class="detail-panel">
        <div class="filters">${tabs.map(([key,label]) => `<button type="button" class="chip" data-action="detail-tab" data-value="${key}" aria-pressed="${detailTab === key}">${label}</button>`).join('')}</div>
        ${contents}
        ${source ? `<p class="small"><a class="btn link" href="${route('entry',source.id)}">From ${esc(source.title || 'an earlier page')} ${icon('arrow')}</a></p>` : ''}
        <div class="actions">
          ${button('edit-saved',entry.kind ? 'Make collage' : 'Edit page','ghost',id)}
          ${button('bookmark',hasBookmark(id) ? 'Bookmarked' : 'Bookmark','ghost',id,hasBookmark(id) ? 'saved' : 'save')}
        </div>
        <hr class="separation">
        <p class="eyebrow" style="margin-bottom:7px">Carry into a new page</p>
        <div class="actions" style="border:0;padding:0">
          ${entry.poem ? `<details class="carry"><summary>A line</summary><div class="carry-options">${splitLines(entry.poem).map((line,i) => button('carry-line',line.length>64 ? line.slice(0,61)+'…' : line,'ghost',id+'|'+i)).join('')}</div></details>` : ''}
          ${photos(entry).length ? `<details class="carry"><summary>An image</summary><div class="carry-options">${photos(entry).map((photo,i) => button('carry-image',photo.name,'ghost',id+'|'+i)).join('')}</div></details>` : ''}
          ${entry.scent ? button('new-scent','This scent','ghost',entry.scent,'scent') : ''}
        </div>
      </section>
    </div>
  </div>`;
}


const steps = [['start','Memory'],['poem','Poem'],['media','Images'],['collage','Collage']];
const modes = {
  journal:['Journal','Write or paste a memory','journal'],
  poem:['Poem','Bring a poem of your own','poem'],
  images:['Images','Start with a visual prompt','prompt']
};
function field(name,label,value,{placeholder='',hint='',area=false,tall=false,max=2400} = {}) {
  const attr = `id="${name}" data-field="${name}" placeholder="${esc(placeholder)}" maxlength="${max}"${hint ? ` aria-describedby="${name}-help"` : ''}`;
  return `<div class="field"><label for="${name}">${esc(label)}</label>
    ${area ? `<textarea ${attr}${tall ? ' class="tall"' : ''}>${esc(value)}</textarea>` : `<input ${attr} value="${esc(value)}">`}
    ${hint ? `<p class="field-help" id="${name}-help">${esc(hint)}</p>` : ''}</div>`;
}
function captureFields() {
  const labels = allScents();
  return `<fieldset>
    <legend class="eyebrow" style="margin-bottom:8px">Scent · Optional</legend>
    <div class="field"><label for="scent">What did it smell like?</label>
      <input id="scent" data-field="scent" maxlength="55" value="${esc(active.scent)}" list="saved-scents" placeholder="Orange peel, wet pavement, cedar…">
      <datalist id="saved-scents">${labels.map(item => `<option value="${esc(item.label)}"></option>`).join('')}</datalist>
    </div>
    ${labels.length ? `<div class="actions" style="margin-bottom:11px">${labels.slice(0,4).map(item => button('choose-scent',item.label,'ghost',item.label,'scent')).join('')}</div>` : ''}
    ${field('smell','Scent detail',active.smell,{placeholder:'Orange peel on my fingers while unpacking',hint:'Use your own words. The short scent name above links this page to others.',max:220})}
  </fieldset>`;
}
function startPanel() {
  const [label,,key] = modes[active.mode];
  const prompts = {journal:senses[active.sense]?.[1] || 'What do you want to remember?',poem:'Write or paste your lines…',images:'Warm window light, a box on the floor, a quiet room…'};
  return `<section class="panel">
    <div class="mode-grid" aria-label="How to start">${Object.entries(modes).map(([value,[title,hint]]) => `<button class="mode" type="button" data-action="mode" data-value="${value}" aria-pressed="${active.mode===value}"><strong>${title}</strong><small>${hint}</small></button>`).join('')}</div>
    ${field('title','Page title',active.title,{placeholder:'Give this memory a name',max:90})}
    ${field(key,active.mode === 'images' ? 'Image prompt' : label,active[key],{placeholder:prompts[active.mode],area:true,tall:true})}
    <hr class="separation">
    ${captureFields()}
    <div class="editor-actions">
      ${button('save-draft','Save & exit','ghost')}
      <div class="actions">
        ${active.mode === 'journal' ? button('save-note','Save note only','ghost') + button('skip-poem','Go to images','ghost') : ''}
        ${button('next-start',active.mode === 'journal' ? 'Draft a poem' : active.mode === 'poem' ? 'Review poem' : 'Continue to images','primary','','arrow')}
      </div>
    </div>
  </section>`;
}
function poemPanel() {
  return `<section class="panel">
    ${active.scent ? `<p class="small" style="margin-bottom:10px">Scent for this page · ${esc(active.scent)}</p>` : ''}
    ${field('poem','Your poem',active.poem,{placeholder:'Write or paste your lines…',area:true,tall:true,max:2000})}
    ${active.mode === 'journal' ? `<div class="actions">${button('redraft','Try another draft','ghost')}<span class="demo-note">Drafts use sample writing patterns in this prototype.</span></div>` : ''}
    <div class="editor-actions">
      <div class="actions">${button('step-back','Back','ghost','','back')}${button('save-draft','Save & exit','ghost')}</div>
      <div class="actions">${button('save-poem','Save poem only','ghost')}${button('approve-poem','Continue to images','primary','','arrow')}</div>
    </div>
  </section>`;
}
function imageOption(item) {
  return `<button class="pick" type="button" data-action="select-image" data-value="${esc(item.id)}" aria-pressed="${active.selected.includes(item.id)}"><img src="${esc(item.src)}" alt=""><span class="pick-name">${esc(item.name)}</span></button>`;
}
function mediaPanel() {
  const options = [...new Set([...active.generated,...active.selected.filter(id => artworkById(id))])].map(artworkById);
  return `<section class="panel">
    <h3>Bring your keepsakes</h3>
    <p class="small">Add photos, screenshots, or pictures of found objects. Choose up to three for this page.</p>
    <div class="field" style="margin-top:10px"><label for="upload">Upload images</label>

      <input type="file" id="upload" accept="image/*" multiple ${active.uploads.length >= 5 ? 'disabled' : ''}>
    </div>
    ${active.uploads.length ? `<div class="uploads">${active.uploads.map(item => `<div class="upload-tile">${imageOption(item)}${iconButton('remove-upload','Remove ' + item.name,item.id,'cross')}</div>`).join('')}</div>` : ''}
    <hr class="separation">
    <h3>Explore image ideas</h3>
    <p class="small">Use details from your memory, poem, or scent to guide the scene.</p>
    ${active.scent ? `<p class="small" style="margin:6px 0">Scent for this page · ${esc(active.scent)}</p>` : ''}
    ${field('prompt','Image prompt',active.prompt,{placeholder:'Add a place, a texture, or a quality of light',area:true,max:850})}
    ${button('generate-images',active.generated.length ? 'Refresh sample images' : 'Show sample images','ghost')}
    <p class="demo-note">Image generation is simulated with a small sample library. Select images to include, or use your own.</p>
    ${options.length ? `<div class="options">${options.map(imageOption).join('')}</div>` : ''}
    <div class="editor-actions">
      <div class="actions">${button('step-back','Back','ghost','','back')}${button('save-draft','Save & exit','ghost')}</div>
      <div class="actions">
        ${active.uploads.length && active.selected.some(id => artworkById(id)) ? button('uploads-only','Use uploads only','ghost') : ''}
        ${button('compose',active.selected.length ? 'Compose with selected' : 'Compose scene','primary','','arrow')}
      </div>
    </div>
  </section>`;
}
function optionChips(action, options) {
  return options.map(([value,label]) => `<button class="chip" type="button" data-action="${action}" data-value="${value}" aria-pressed="${active[action]===value}">${label}</button>`).join('');
}
function collagePanel() {
  return `<div class="editor-grid">
    <section class="panel"><p class="eyebrow">Live preview</p><div id="collage-preview">${scene(active)}</div></section>
    <section class="panel">
      <h3>Arrange your page</h3>
      ${field('title','Title',active.title,{placeholder:'Untitled memory',max:90})}
      ${field('poem','Poem lines',active.poem,{placeholder:'Optional text to place on the page',area:true,max:2000})}
      ${field('note','Handwritten note',active.note,{placeholder:'Something to keep in the margin',max:110})}
      <fieldset class="field"><legend>Layout</legend><div class="actions">${optionChips('layout',[['layered','Layered'],['split','Split'],['quiet','Quiet']])}</div></fieldset>
      <fieldset class="field"><legend>Paper color</legend><div class="actions">${optionChips('tint',[['sand','Sand'],['ash','Sage'],['rose','Clay']])}</div></fieldset>
      ${active.selected.length ? `<div class="field"><label for="crop">Shift photo crop</label><input id="crop" type="range" min="0" max="100" value="${active.crop}" data-field="crop"></div>` : ''}
      ${active.scent ? `<div class="field"><label><input type="checkbox" data-field="showScent" ${active.showScent ? 'checked' : ''}> Show scent label on collage</label></div>` : ''}
      ${photos(active).map((item,i,list) => `<div class="layer-row"><span class="small">${i+1}. ${esc(item.name)}</span>${iconButton('move-up','Move image earlier',item.id,'up',i===0)}${iconButton('move-down','Move image later',item.id,'down',i===list.length-1)}${iconButton('remove-layer','Remove from collage',item.id,'cross')}</div>`).join('')}
      <div class="editor-actions">
        <div class="actions">${button('step-back','Images','ghost','','back')}${button('save-draft','Save & exit','ghost')}</div>
        ${button('save-scene','Save scene','primary','','arrow')}
      </div>
    </section>
  </div>`;
}
function renderWizard(id) {
  if (!active || active.id !== id) {
    const draft = itemById(id);
    if (!draft || draft.status !== 'draft') {
      main.innerHTML = `<div class="wrap view">${backLink('#diary')}${empty('Draft unavailable','You can start a fresh page from the diary.',button('new','New page','primary','','plus'))}</div>`;
      return;
    }
    active = structuredClone(draft);
  }
  const config = {
    start:['Make a new page','Begin with a memory, a poem, or a visual idea.',startPanel],
    poem:['Find the lines','Shape the words you want to carry into the collage.',poemPanel],
    media:['Gather the images','Combine your keepsakes with a few image ideas.',mediaPanel],
    collage:['Make it yours','Arrange the page and see how it will look in your diary.',collagePanel]
  };
  const stage = active.stage;
  const [title,desc,panel] = config[stage];
  main.innerHTML = `<div class="wrap view"><div class="wizard ${stage === 'collage' ? 'wide' : ''}">
    ${button('save-draft','Diary','link','','back')}${viewTitle(active.editOf ? 'Edit a saved page' : 'Create a page',title,desc)}
    <div class="progress" aria-label="Creation progress">${steps.filter(([key]) => !(key === 'poem' && (active.mode === 'images' || active.skippedPoem))).map(([key,label]) => `<span${stage === key ? ' class="current" aria-current="step"' : ''}>${label}</span>`).join('')}</div>
    ${panel()}
  </div></div>`;
}
function render(focus = false) {
  const [page,id] = locate();
  if (active && (page !== 'edit' || id !== active.id)) {
    rememberDraft();
    active = null;
  }
  renderHeader(page);
  if (page === 'edit') renderWizard(id);
  else if (page === 'entry') renderDetail(id);
  else if (page === 'scents') renderIndex();
  else if (page === 'scent') renderScent(id);
  else if (page === 'saved') renderSaved();
  else renderDiary();
  if (focus) { window.scrollTo(0,0); main.focus({preventScroll:true}); }
}
function newDraft(values = {}) {
  if (active && !rememberDraft()) return;
  active = {...fresh(), ...values};
  go('edit',active.id);
}
function advance(stage) {
  const previous = active.stage;
  active.stage = stage;
  if (!rememberDraft()) { active.stage = previous; return; }
  render(true);
}
function draftPoem() {
  const source = active.journal.trim().split(/[.!?\n]/)[0].split(/\s+/).slice(0,10).join(' ');
  const scent = active.smell.trim() || active.scent.trim();
  const patterns = scent ? [
    [source + '.', 'The air still held ' + scent + '.', 'I carried a little of it home.'],
    ['There was ' + scent + ' in the air.', source + '.', 'Some things stay after the room goes quiet.'],
    [source + '.', 'I remember ' + scent, 'and how the room became that moment.']
  ] : [
    [source + '.', 'I kept that moment for a while', 'like a piece of paper in my pocket.'],
    [source + '.', 'The day went on.', 'This part of it stayed.'],
    [source + '.', 'In the pause afterward,', 'I could still feel the shape of it.']
  ];
  active.poem = patterns[active.version++ % patterns.length].join('\n');
}
function imageIdeas() {
  const text = normalize([active.scent,active.smell,active.prompt,active.journal,active.poem].join(' '));
  const matches = [/orange|citrus|kitchen|sunlight|peel/,/glass|drink|friend|dusk/,/rain|water|pavement|window|café|cafe/];
  active.generated = artwork.map((item,i) => [item.id,matches[i].test(text) ? 1 : 0])
    .sort((a,b) => b[1]-a[1]).map(([id]) => id);
}
function setBookmark(key,id) {
  const found = state[key].includes(id);
  const list = found ? state[key].filter(item => item !== id) : [...state[key],id];
  if (persist({...state,[key]:list})) {
    render();
    message(found ? 'Removed from Saved.' : 'Added to Saved.');
  }
}
function editSaved(id) {
  const entry = itemById(id);
  const existing = state.entries.find(draft => draft.status === 'draft' && draft.editOf === id);
  if (existing) { go('edit',existing.id); return; }
  newDraft({...structuredClone(entry),id:makeId(),status:'draft',editOf:id,stage:entry.kind ? 'media' : 'collage',skippedPoem:!entry.poem,updated:now()});
}
function finalize(kind = '') {
  if (!['title','journal','poem','prompt','note','scent','smell'].some(key => active[key].trim()) && !active.selected.length) {
    message('Add a line, a scent, or an image before saving.');
    return;
  }
  const id = active.editOf || active.id;
  const fallback = (active.journal || active.poem || active.prompt).trim().split(/\n/)[0];
  const title = active.title.trim() || (fallback.length > 58 ? fallback.slice(0,55) + '…' : fallback) || active.scent.trim() || 'Untitled memory';
  const scent = allScents().find(item => item.key === normalize(active.scent))?.label ?? active.scent.trim().replace(/\s+/g,' ');
  const saved = {...active,id,title,scent,kind,status:'saved',stage:'collage',updated:now()};
  delete saved.editOf;
  const entries = [saved,...state.entries.filter(entry => entry.id !== active.id && entry.id !== id)];
  if (!persist({...state,entries})) return;
  active = null;
  detailId = '';
  go('entry',id);
  message(kind === 'journal' ? 'Note saved to your diary.' : kind === 'poem' ? 'Poem saved to your diary.' : 'Scene saved to your diary.');
}
function selectImage(id) {
  if (active.selected.includes(id)) active.selected = active.selected.filter(item => item !== id);
  else if (active.selected.length >= 3) { message('Choose up to three images. Remove one to select another.'); return; }
  else active.selected.push(id);
  rememberDraft();
  render();
}
function moveLayer(id,direction) {
  const index = active.selected.indexOf(id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= active.selected.length) return;
  [active.selected[index],active.selected[next]] = [active.selected[next],active.selected[index]];
  rememberDraft();
  render();
}
function resizeImage(file) {
  return new Promise((resolve,reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Unsupported image')); };
    img.onload = () => {
      try {
        const scale = Math.min(1,900/Math.max(img.width,img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1,Math.round(img.width*scale));
        canvas.height = Math.max(1,Math.round(img.height*scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#f4ead4';
        context.fillRect(0,0,canvas.width,canvas.height);
        context.drawImage(img,0,0,canvas.width,canvas.height);
        resolve({id:makeId(),name:file.name,src:canvas.toDataURL('image/jpeg',.76)});
      } catch (error) { reject(error); }
      finally { URL.revokeObjectURL(url); }
    };
    img.src = url;
  });
}
async function uploadFiles(files) {
  const target = active;
  const available = 5 - target.uploads.length;
  const results = await Promise.allSettled([...files].slice(0,available).map(resizeImage));
  if (active !== target) return;
  const added = results.filter(item => item.status === 'fulfilled').map(item => item.value);
  const previous = [...active.selected];
  active.uploads.push(...added);
  active.selected.push(...added.slice(0,Math.max(0,3-active.selected.length)).map(item => item.id));
  if (!rememberDraft()) {
    active.uploads = active.uploads.filter(item => !added.includes(item));
    active.selected = previous;
  } else if (results.length !== added.length) message('Some images could not be opened. Try JPEG or PNG.');
  else if (files.length > available) message('You can keep up to five uploads per draft.');
  render();
}
function requireText(key,notice) {
  if (active[key].trim()) return true;
  message(notice);
  document.querySelector('#' + key)?.focus();
  return false;
}
function carryImage(value) {
  const [id,index] = value.split('|');
  const photo = photos(itemById(id))[Number(index)];
  if (photo) newDraft({parentId:id,uploads:artworkById(photo.id) ? [] : [photo],selected:[photo.id]});
}
function carryLine(value) {
  const [id,index] = value.split('|');
  const line = splitLines(itemById(id).poem)[Number(index)];
  if (line) newDraft({parentId:id,note:line.slice(0,110)});
}
const actions = {
  new:() => newDraft(),
  'home-view':value => selectHomeView(Number(value)),
  'home-turn':value => rotateHome(Number(value)),
  'pick-sense':selectSense,
  'new-from-sense':() => newDraft(homeSense ? {sense:homeSense} : {}),
  'new-scent':scent => newDraft({scent}),
  filter:value => {
    filter = value;
    deckEntryId = '';
    document.querySelectorAll('[data-action="filter"]').forEach(control => control.setAttribute('aria-pressed',control.dataset.value === value));
    renderEntries();
  },
  'deck-select':id => {
    deckEntryId = id;
    renderEntries();
    document.querySelector('#entries').focus({preventScroll:true});
  },
  'deck-step':value => {
    const list = filteredEntries();
    if (list.length < 2) return;
    const index = Math.max(0,list.findIndex(entry => entry.id === deckEntryId));
    deckEntryId = list[(index+Number(value)+list.length)%list.length].id;
    const keepControl = document.activeElement?.dataset.action === 'deck-step';
    renderEntries();
    document.querySelector(keepControl ? '[data-action="deck-step"][data-value="'+value+'"]' : '#entries').focus({preventScroll:true});
  },
  'clear-search':() => {
    query = '';
    deckEntryId = '';
    document.querySelector('#search').value = '';
    renderEntries();
    document.querySelector('#search').focus();
  },
  'complete-draft':id => {
    const entry = itemById(id);
    if (!entry || entry.status !== 'draft' || !canComplete(entry)) return;
    active = structuredClone(entry);
    finalize(entry.stage === 'collage' ? '' : entry.poem.trim() ? 'poem' : 'journal');
    active = null;
  },
  resume:id => go('edit',id),
  entry:id => go('entry',id),
  bookmark:id => setBookmark('entryBookmarks',id),
  'bookmark-scent':key => setBookmark('scentBookmarks',key),
  'detail-tab':value => { detailTab = value; render(); },
  'edit-saved':editSaved,
  'carry-line':carryLine,
  'carry-image':carryImage,
  mode:value => { active.mode = value; render(); document.querySelector('#' + modes[value][2])?.focus(); },
  'choose-scent':value => {
    active.scent = value;
    document.querySelector('#scent').value = value;
    rememberDraft();
  },
  'next-start':() => {
    if (active.mode === 'journal') {
      if (!requireText('journal','Write or paste a few words first.')) return;
      if (!active.poem.trim()) draftPoem();
    }
    if (active.mode === 'poem' && !requireText('poem','Write or paste your poem first.')) return;
    active.skippedPoem = active.mode === 'images';
    advance(active.skippedPoem ? 'media' : 'poem');
  },
  'skip-poem':() => { active.skippedPoem = true; advance('media'); },
  'approve-poem':() => advance('media'),
  redraft:() => { draftPoem(); rememberDraft(); render(); },
  'save-draft':() => {
    if (!rememberDraft()) return;
    if (itemById(active.id)) {
      filter = 'Recent';
      query = '';
      deckEntryId = active.id;
      message('Draft saved.');
    }
    active = null;
    go('diary');
  },
  'step-back':() => {
    const previous = {poem:'start',media:active.skippedPoem || active.mode === 'images' ? 'start' : 'poem',collage:'media'};
    advance(previous[active.stage] || 'start');
  },
  'generate-images':() => { imageIdeas(); rememberDraft(); render(); message('Sample images are ready to choose.'); },
  'select-image':selectImage,
  'remove-upload':id => {
    active.uploads = active.uploads.filter(item => item.id !== id);
    active.selected = active.selected.filter(item => item !== id);
    rememberDraft();
    render();
  },
  'uploads-only':() => { active.selected = active.uploads.slice(0,3).map(item => item.id); advance('collage'); },
  compose:() => advance('collage'),
  layout:value => { active.layout = value; rememberDraft(); render(); },
  tint:value => { active.tint = value; rememberDraft(); render(); },
  'remove-layer':selectImage,
  'move-up':id => moveLayer(id,-1),
  'move-down':id => moveLayer(id,1),
  'save-note':() => { if (requireText('journal','Write or paste a few words first.')) finalize('journal'); },
  'save-poem':() => { if (requireText('poem','Write or paste your poem first.')) finalize('poem'); },
  'save-scene':() => finalize()
};
document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (button) actions[button.dataset.action]?.(button.dataset.value);
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (link.classList.contains('skip')) { main.focus(); return; }
  const destination = link.getAttribute('href');
  if (location.hash !== destination) location.hash = destination;
  else render(true);
});
document.addEventListener('input', event => {
  if (event.target.id === 'search') { query = event.target.value; deckEntryId = ''; renderEntries(); return; }
  const key = event.target.dataset.field;
  if (!key || !active) return;
  active[key] = event.target.type === 'checkbox' ? event.target.checked : event.target.type === 'range' ? Number(event.target.value) : event.target.value;
  const preview = document.querySelector('#collage-preview');
  if (preview) preview.innerHTML = scene(active);
});
document.addEventListener('change', event => {
  if (event.target.id === 'upload' && active) void uploadFiles(event.target.files);
  if (event.target.dataset.field && active) rememberDraft();
});
document.addEventListener('submit', event => {
  if (event.target.id !== 'entries-search') return;
  event.preventDefault();
  selectHomeView(0);
  document.querySelector('#entries').focus({preventScroll:true});
});
document.addEventListener('keydown', event => {
  if (!document.querySelector('.home-turntable') || event.defaultPrevented ||
      event.altKey || event.metaKey || event.ctrlKey ||
      !['ArrowLeft','ArrowRight'].includes(event.key) ||
      event.target.closest?.('input, textarea, [contenteditable]')) return;
  event.preventDefault();
  if (!event.repeat) rotateHome(event.key === 'ArrowLeft' ? -1 : 1);
});
document.addEventListener('wheel', event => {
  if (!event.target.closest('.entries-home') || event.ctrlKey) return;
  const horizontal = event.shiftKey && Math.abs(event.deltaX) < 1 ? event.deltaY : event.deltaX;
  if (!horizontal || (!event.shiftKey && Math.abs(horizontal) <= Math.abs(event.deltaY))) return;
  event.preventDefault();
  const time = performance.now();
  if (time - wheelLast > 160) { wheelDistance = 0; wheelUsed = false; }
  wheelLast = time;
  if (wheelUsed) return;
  wheelDistance += horizontal * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 48 : 1);
  if (Math.abs(wheelDistance) >= 30) {
    wheelUsed = true;
    rotateHome(Math.sign(wheelDistance));
  }
},{passive:false});
document.addEventListener('touchstart', event => {
  swipeOrigin = event.target.closest('.entries-home') &&
    !event.target.closest('.entries-search, .home-dock') &&
    event.touches.length === 1 ? event.touches[0] : null;
},{passive:true});
document.addEventListener('touchend', event => {
  if (!swipeOrigin) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - swipeOrigin.clientX;
  const dy = touch.clientY - swipeOrigin.clientY;
  swipeOrigin = null;
  if (Math.abs(dx) < 46 || Math.abs(dx) < 1.4 * Math.abs(dy)) return;
  if (event.cancelable) event.preventDefault();
  rotateHome(dx < 0 ? 1 : -1);
},{passive:false});
document.addEventListener('touchcancel', () => { swipeOrigin = null; },{passive:true});
window.addEventListener('hashchange', () => render(true));
window.addEventListener('pagehide', () => { if (active) rememberDraft(); });
render();

