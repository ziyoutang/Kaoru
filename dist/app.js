
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
let pendingSceneEdit = null;
let senseDraft = null;
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
  if (existing || ['title','journal','poem','prompt','scent','smell','note','parentId'].some(key => active[key]?.trim()) || active.uploads.length || active.selected.length || active.sourceFiles?.length) {
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
      <span class="brand-mark">Kaoru</span>
      <span class="brand-slogan">keep what lingers</span>
    </a>
  </div>`;
}
function photos(entry) {
  return entry.selected.map(id => entry.uploads.find(file => file.id === id) || artworkById(id)).filter(Boolean);
}
function photoCrop(entry,id) {
  return Number(entry.photoCrops?.[id] ?? entry.crop ?? 50);
}
function scene(entry, interactive = false) {
  const images = photos(entry);
  const excerpt = splitLines(entry.poem).slice(0,3).join('\n');
  const piece = (kind,name,style,content,key = '') => {
    const crop = kind === 'image' ? ` style="--crop:${photoCrop(entry,key)}%"` : '';
    if (!interactive) return `<div class="${style}"${crop}>${content}</div>`;
    return `<div class="${style} scene-piece" data-kind="${kind}" data-key="${esc(key)}"${crop}>
      <button type="button" class="scene-piece-trigger" aria-label="${esc(name)}" aria-expanded="false">${content}</button>
      <button type="button" class="scene-piece-edit" aria-label="Edit ${esc(name)}" hidden>Edit?</button>
    </div>`;
  };
  const placePhoto = (item,style) => item ? piece('image',item.name,style,`<img src="${esc(item.src)}" alt="${interactive ? '' : esc(item.name)}">`,item.id) : '';
  return `<div class="scene-art layout-${entry.layout} tint-${entry.tint}"${interactive ? ` data-scene-entry="${esc(entry.id)}"` : ''}>
    ${images[0] ? placePhoto(images[0],'main-photo') : `<div class="blank-art" aria-hidden="true">${icon('scent')}</div>`}
    ${placePhoto(images[2],'little-photo third-photo')}${placePhoto(images[1],'little-photo')}
    ${excerpt ? piece('poem','Poem lines','fragment',`<span>${esc(excerpt)}</span>`) : ''}
    ${entry.note ? piece('note','Handwritten note','margin-note',`<span>${esc(entry.note)}</span>`) : ''}
    ${entry.scent && entry.showScent ? piece('scent',entry.scent,'chip art-chip',`${icon('scent')} ${esc(entry.scent)}`) : ''}
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
    return alternateEntries(list.sort((a,b) => Number(b.status === 'draft') - Number(a.status === 'draft') || b.updated.localeCompare(a.updated)).slice(0,6));
  }
  const sorted = list.sort(byDate);
  return filter === 'All' ? alternateEntries(sorted) : sorted;
}
function alternateEntries(list) {
  const remaining = [...list], result = [];
  const forms = ['poem','collage','journal'];
  const supports = (entry,kind) => kind === 'poem' ? Boolean(entry.poem) : kind === 'collage' ? photos(entry).length > 0 : Boolean(entry.journal);
  while (remaining.length) {
    const desired = forms[result.length % forms.length];
    let index = remaining.findIndex(entry => supports(entry,desired));
    if (index < 0) index = 0;
    const entry = remaining.splice(index,1)[0];
    const previewKind = supports(entry,desired) ? desired : entry.kind || (entry.mode === 'poem' ? 'poem' : photos(entry).length ? 'collage' : 'journal');
    result.push({...entry,previewKind});
  }
  return result;
}
function deckSheet(entry, slot) {
  const title = entry ? entry.title || 'Untitled memory' : 'New page +';
  const photo = entry && photos(entry)[0];
  const action = entry ? 'deck-select' : 'home-view';
  const label = entry ? 'Select ' + title : 'Start a new page';
  return `<div class="deck-sheet sheet-${slot}" data-deck-card="${esc(entry?.id || '')}">
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
  return `<article class="deck-front" data-deck-card="${esc(entry.id)}">
    <div class="front-caption"><p>${dateLabel(entry.created)} · ${kind}</p><h2>${esc(title)}</h2></div>
    <div class="front-actions">
      ${draft ? button('resume','Continue Writing','deck-action',entry.id,'arrow') : button('entry','Open entry','deck-action',entry.id,'arrow')}

    </div>
    ${entry.scent ? scentChip(entry.scent,'front-scent') : ''}
  </article>`;
}
function categoryGallery(list, index) {
  const isCollage = filter === 'Collages';
  const isJournal = filter === 'Journal';
  const mixed = ['All','Recent'].includes(filter);
  const size = isCollage ? 2 : 3;
  const start = index - index % size;
  const end = start + size;
  const cards = list.slice(start,end).map(entry => {
    const title = esc(entry.title || 'Untitled memory');
    const kind = entry.previewKind || entry.kind || (entry.status === 'saved' || ['images','media','collage'].includes(entry.stage) || entry.mode === 'images' ? 'collage' : entry.mode === 'poem' ? 'poem' : 'journal');
    if (isCollage || mixed && kind === 'collage') {
      return `<article class="collage-card">
        <button class="collage-card-title" type="button" data-action="${entry.status === 'draft' ? 'resume' : 'entry-collage'}" data-value="${esc(entry.id)}" aria-label="Open collage: ${title}">${title}</button>
        <div class="collage-card-art">${scene(entry,true)}</div>
      </article>`;
    }
    if (isJournal || mixed && kind === 'journal') {
      return `<button class="poem-card journal-leaf" type="button" data-action="${entry.status === 'draft' ? 'resume' : 'entry-journal'}" data-value="${esc(entry.id)}" aria-label="Open journal: ${title}">
        <span class="poem-flight">
          <span class="journal-leaf-paper"><time>${dateLabel(entry.created)}</time><span class="journal-leaf-text">${esc(entry.journal || 'A memory waiting to be written…')}</span></span>
          <span class="poem-tether"><span class="poem-tag"><span>${title}</span></span></span>
        </span>
      </button>`;
    }
    const action = entry.status === 'draft' ? 'resume' : 'entry-poem';
    return `<button class="poem-card" type="button" data-action="${action}" data-value="${esc(entry.id)}" aria-label="Open poem: ${title}">
      <span class="poem-flight">
        <span class="poem-silhouette"><img src="assets/entries/origami-bird.png" width="450" height="452" alt=""></span>
        <span class="poem-tether"><span class="poem-tag"><span>${title}</span></span></span>
      </span>
    </button>`;
  }).map((card,i) => mixed ? `<div class="mixed-entry">${card}</div>` : card).join('');
  const pages = `<nav class="category-pages poem-pages" aria-label="${filter} pages">
    ${start > 0 ? iconButton('poem-page','Previous page',list[start-size].id,'back') : ''}
    <span class="entries-status">${start+1}–${Math.min(end,list.length)} of ${list.length}</span>
    ${iconButton('poem-page','Next page',list[end < list.length ? end : 0].id,'arrow',list.length <= size)}
  </nav>`;
  return `<div class="${isCollage ? 'collage-home' : isJournal ? 'poems-home journal-leaves' : mixed ? 'poems-home mixed-home' : 'poems-home'}">${cards}</div>${pages}`;
}
function renderEntries() {
  const list = filteredEntries();
  const index = Math.max(0,list.findIndex(entry => entry.id === deckEntryId));
  const front = list[index];
  deckEntryId = front?.id || '';
  const next = list.slice(index+1).concat(list.slice(0,index));
  const deck = document.querySelector('#entries');
  const category = Boolean(front);
  deck.setAttribute('aria-label',category ? filter : 'Switch between diary entries');
  if (category) {
    deck.removeAttribute('aria-roledescription');
    delete deck.dataset.sheets;
    const content = categoryGallery(list,index);
    const status = filter === 'Journal' ? `Journal ${index+1} of ${list.length}. ${esc(front.title || 'Untitled memory')}.` : `${list.length} ${filter.toLowerCase()} available.`;
    deck.innerHTML = `${content}<p class="entries-status" role="status">${status}</p>`;
    return;
  }
  deck.setAttribute('aria-roledescription','carousel');
  const back = next.slice(0,3);
  if (front && !query && back.length < 3) back.push(null);
  deck.dataset.sheets = back.length;
  deck.innerHTML = `
    ${back.map((entry,i) => deckSheet(entry,i+1)).reverse().join('')}
    ${frontSheet(front)}
    <p class="entries-status" role="status">${front ? `Entry ${index+1} of ${list.length}. ${esc(front.title || 'Untitled memory')}.` : 'No entries to show.'}</p>`;
}
async function turnPoemPage(id) {
  const deck = document.querySelector('#entries');
  const birds = deck?.querySelector('.poems-home,.collage-home');
  if (!birds || deck.dataset.paging) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { selectDeckEntry(id); return; }
  deck.dataset.paging = 'true';
  await birds.animate([{opacity:1},{opacity:0}],{duration:240,easing:'ease-in',fill:'forwards'}).finished;
  delete deck.dataset.paging;
  if (!birds.isConnected || !['Poems','Journal','All','Recent','Collages'].includes(filter)) return;
  selectDeckEntry(id);
  deck.querySelector('.poems-home,.collage-home').animate([{opacity:0},{opacity:1}],{duration:420,easing:'ease-out'});
}
async function selectDeckEntry(id) {
  const deck = document.querySelector('#entries');
  if (!deck || deck.dataset.switching || deckEntryId === id) return;
  const motion = deck.getAttribute('aria-roledescription') === 'carousel' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const currentFilter = filter;
  if (motion) {
    deck.dataset.switching = 'true';
    await deck.animate([{opacity:1,translate:'0px 0px'},{opacity:0,translate:'-10px 0px'}],{duration:180,easing:'ease-in',fill:'forwards'}).finished;
    delete deck.dataset.switching;
    if (!deck.isConnected || filter !== currentFilter) {
      deck.getAnimations().forEach(animation => animation.cancel());
      return;
    }
  }
  deckEntryId = id;
  renderEntries();
  if (motion) {
    deck.getAnimations().forEach(animation => animation.cancel());
    deck.animate([{opacity:0,translate:'10px 0px'},{opacity:1,translate:'0px 0px'}],{duration:420,easing:'cubic-bezier(.22,.61,.36,1)'});
  }
  deck.focus({preventScroll:true});
}
const homeViews = ['Entries','Senses','Create New'];
const homeMotifs = `
  <img class="home-motif motif-taste" src="assets/entries/citrus-slice.svg" width="130" height="130" alt="">
  <img class="home-motif motif-smell" src="assets/entries/scent-wisps.svg" width="106" height="108" alt="">
  <img class="home-motif motif-touch" src="assets/entries/fingerprint.svg" width="146" height="145" alt="">
  <img class="home-motif motif-lavender" src="assets/entries/lavender.svg" width="98" height="116" alt="">
  <img class="home-motif motif-hearing" src="assets/entries/sound-ripples.svg" width="108" height="80" alt="">
  <img class="home-motif motif-sight" src="assets/entries/prism.svg" width="109" height="85" alt="">`;
const senses = {
  eyes:['Sight','What caught your eye?'],
  ears:['Hearing','What could you hear?'],
  hand:['Touch','What did it feel like?'],
  nose:['Smell','What did it smell like?'],
  lips:['Taste','What did it taste like?']
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
    <nav class="entries-filters" aria-label="Filter entries">
      ${['All','Collages','Recent','Journal','Poems'].map(label => `<button type="button" data-action="filter" data-value="${label}" aria-pressed="${label === filter}">${label === 'All' ? 'ALL' : label}</button>`).join('')}
    </nav>
    <div class="home-orbit">
      <div class="home-turntable">
        <section class="home-face face-entries" data-home-face="0" data-node-id="18:198" aria-label="Entries">
          ${homeMotifs}
          <div class="home-panel">
            <div id="entries" class="entries-deck" role="region" aria-roledescription="carousel" aria-label="Switch between diary entries" tabindex="0"></div>
          </div>
        </section>
        <section class="home-face face-senses" data-home-face="1" data-node-id="18:204" aria-label="Senses" inert aria-hidden="true">
          ${homeMotifs}
          <div class="home-panel">
            ${Object.entries(senses).map(([id,[label]]) => `<button type="button" class="sense-tile sense-${id}" data-action="pick-sense" data-value="${id}" aria-pressed="false" aria-label="${label}" title="Drag to rotate or use Shift and the arrow keys"><canvas class="sense-model" data-sense-model="${id}" aria-hidden="true"></canvas><span class="sense-label">${label}</span></button>`).join('')}
          </div>
        </section>
        <section class="home-face face-create" data-home-face="2" data-node-id="18:227" aria-label="Create New" inert aria-hidden="true">
          ${homeMotifs}
          <div class="home-panel">
            <div class="home-create">
              ${button('new-from-sense','Create New','home-create-button')}
              <p id="create-instruction">Start with a journal, a poem, or an image.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
    <div class="sense-caption" hidden><span id="sense-status" role="status">Drag to rotate · tap to select</span><a href="#scents">Browse scents →</a></div>
    <button class="home-next" type="button" data-action="home-turn" data-value="1">
      <span id="home-next-label">Senses</span>${icon('arrow')}
    </button>
    <form id="entries-search" class="entries-search" role="search">
      <button class="entries-search-trigger" type="button" data-action="open-search" aria-label="Open diary search" aria-controls="search">${icon('search')}</button>
      <input id="search" type="search" placeholder="search for what you want...." value="${esc(query)}" aria-label="Search notes, poems, and scents" hidden>
      <button class="entries-search-submit" type="submit" aria-label="Search diary" hidden><img src="assets/entries/search-arrow.svg" width="28" height="15" alt="" data-node-id="18:248"></button>
    </form>
    <p id="home-announcement" class="entries-status" role="status"></p>
  </section>`;
  renderEntries();
}
function setSearchExpanded(form, expanded) {
  form.classList.toggle('is-expanded',expanded);
  const input=form.querySelector('#search');
  input.hidden=!expanded;
  form.querySelector('.entries-search-submit').hidden=!expanded;
  if (expanded) input.focus({preventScroll:true});
  form.querySelector('.entries-search-trigger').hidden=expanded;
}
function rotateHome(direction) {
  const turntable = document.querySelector('.home-turntable');
  if (!turntable || turntable.parentElement.classList.contains('is-turning')) return;
  const previousIndex = homeIndex();
  homeTurn += direction;
  const index = homeIndex();
  if (document.activeElement?.closest('.home-face, .entries-filters, .sense-caption')) document.querySelector('.home-next')?.focus({preventScroll:true});
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    turntable.parentElement.classList.add('is-turning');
    const panels = turntable.querySelectorAll('.home-panel');
    panels[previousIndex].animate([
      {opacity:1,transform:'translateY(0) scale(1)'},
      {opacity:0,transform:'translateY(-12px) scale(.92)'}
    ], {duration:480,easing:'cubic-bezier(.4,0,.6,1)'});
    panels[index].animate([
      {opacity:0,transform:'translateY(20px) scale(.9)',offset:0},
      {opacity:0,transform:'translateY(20px) scale(.9)',offset:.24},
      {opacity:.85,transform:'translateY(3px) scale(.985)',offset:.78},
      {opacity:1,transform:'translateY(0) scale(1)',offset:1}
    ], {duration:1250,easing:'cubic-bezier(.22,.61,.36,1)'});
  }
  turntable.style.setProperty('--home-angle', `${-120 * homeTurn}deg`);
  turntable.querySelectorAll('.home-face').forEach((face,i) => {
    face.inert = i !== index;
    face.setAttribute('aria-hidden',String(i !== index));
  });
  document.querySelector('.entries-filters').inert = index !== 0;
  document.querySelector('.sense-caption').hidden = index !== 1;
  if (index === 1) {
    const face = document.querySelector('.face-senses');
    requestAnimationFrame(() => {
      if (face.isConnected && !face.inert) window.KaoruSenses.mount(face);
    });
  }
  document.querySelector('#home-next-label').textContent = homeViews[(index + 1) % homeViews.length];
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
  document.querySelector('#sense-status').textContent = prompt || 'Drag to rotate · tap to select';
  document.querySelector('#create-instruction').textContent = prompt || 'Start with a journal, a poem, or an image.';
}

function backLink(href,label = 'Back to diary') {
  return `<a class="btn link" href="${href}">${icon('back')} ${esc(label)}</a>`;
}
function viewTitle(tag,title,description = '') {
  return `<div class="view-title"><p class="kicker">${esc(tag)}</p><h1>${esc(title)}</h1>${description ? `<p>${esc(description)}</p>` : ''}</div>`;
}
const createChoices = [
  ['journal','Journal','Write or import a memory'],
  ['poem','Poem','Write or import your lines'],
  ['images','Collages','Start with images or a prompt'],
  ['senses','Senses','Capture or reuse a sense']
];
function senseRecords() {
  const captured = state.senseNotes || [];
  const existing = allScents()
    .filter(item => !captured.some(note => note.type === 'nose' && normalize(note.name) === item.key))
    .map(item => ({id:'scent:'+item.key,type:'nose',name:item.label,detail:''}));
  return [...captured,...existing];
}
function renderCreate(reference) {
  const note = senseRecords().find(item => item.id === reference);
  main.innerHTML = `<div class="wrap view choice-view create-choice-view" data-node-id="20:283">
    ${backLink('#diary')}
    <h1 class="entries-status">Create New</h1>
    <p class="create-prompt">${note ? 'Carrying ' + esc(note.name) + ' into this page.' : 'What would you like to start with?'}</p>
    <form id="create-flow" data-reference="${esc(reference)}">
      <fieldset class="flow-choices" aria-label="How to start">
        ${createChoices.map(([value,label,hint],i) => `<label class="flow-choice">
          <input type="radio" name="start" value="${value}"${i === 0 ? ' checked' : ''}>
          <span class="flow-tile"><strong>${label}</strong><small>${hint}</small></span>
        </label>`).join('')}
      </fieldset>
      <button type="submit" class="btn flow-continue">Continue ${icon('arrow')}</button>
    </form>
  </div>`;
}
function memoryObject(note) {
  const text = `${note.name} ${note.detail}`.toLowerCase();
  if (/orange|citrus|lemon|peel|grapefruit/.test(text)) return 'citrus';
  if (/rain|pavement|stone|wet|petrichor/.test(text)) return 'pavement';
  if (/flower|lavender|rose|jasmine|blossom/.test(text)) return 'flower';
  if (/linen|fabric|cloth|silk|soft|cotton/.test(text)) return 'fabric';
  if (/leaf|forest|wood|cedar|grass|tea/.test(text)) return 'leaf';
  if (/sweet|sugar|honey|candy|chocolate/.test(text)) return 'sweet';
  return {hand:'fabric',lips:'sweet',eyes:'leaf',ears:'wisp',nose:'wisp'}[note.type] || 'wisp';
}
function renderSenseSelect(type) {
  main.innerHTML = `<div class="wrap view choice-view" data-node-id="26:470">
    ${backLink(route('create',type),'Back to Create New')}
    <h1 class="entries-status">Sense Selection</h1>
    <div class="flow-choices sense-choices">
      <a class="flow-tile" href="${route('capture',type)}"><strong>Capture a new sense</strong></a>
      <button class="flow-tile" data-action="show-sense-wheel" aria-expanded="false" aria-controls="saved-sense-wheel"><strong>Reuse an existing sense</strong></button>
      <section id="saved-sense-wheel" class="sense-wheel-panel" hidden aria-label="Saved senses">
        <p>Scroll to browse your senses</p>
        <div class="sense-wheel" tabindex="0" aria-label="Browse saved senses">
          ${senseRecords().length ? senseRecords().map(note => `<a class="sense-wheel-item" href="${route('captured',note.id)}"><span class="sense-wheel-object" aria-hidden="true"><canvas class="sense-model" data-sense-model="${memoryObject(note)}"></canvas></span><span>${esc(note.name)}</span></a>`).join('') : '<p class="sense-wheel-empty">No saved senses yet. Capture a new sense to start your collection.</p>'}
        </div>
      </section>
    </div>
  </div>`;
}
function shapeSenseWheel() {
  const wheel = document.querySelector('.sense-wheel');
  if (!wheel) return;
  const center = wheel.getBoundingClientRect().top + wheel.clientHeight / 2;
  let closest = null, closestDistance = Infinity;
  const items = wheel.querySelectorAll('.sense-wheel-item');
  items.forEach(item => {
    const rect = item.getBoundingClientRect();
    const distance = Math.min(1,Math.abs(rect.top + rect.height / 2 - center) / (wheel.clientHeight / 2));
    if (distance < closestDistance) { closest = item; closestDistance = distance; }
    item.style.transform = `translateX(${-32 * distance * distance}px) scale(${1 - distance * .18})`;
    item.style.opacity = 1 - distance * .45;
  });
  items.forEach(item => item.classList.toggle('is-centered',item === closest));
}
function showSenseWheel() {
  const panel = document.querySelector('#saved-sense-wheel');
  if (!panel.hidden) return;
  const reveal = () => {
    panel.hidden = false;
    panel.closest('.sense-choices').classList.add('is-browsing');
    document.querySelector('[data-action="show-sense-wheel"]').setAttribute('aria-expanded','true');
    const wheel = panel.querySelector('.sense-wheel');
    wheel.addEventListener('scroll',shapeSenseWheel,{passive:true});
    window.KaoruSenses.mount(panel);
    requestAnimationFrame(shapeSenseWheel);
  };
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { reveal(); return; }
  if (document.documentElement.classList.contains('reuse-transition')) return;
  document.documentElement.classList.add('reuse-transition');
  const transition = document.startViewTransition(reveal);
  transition.finished.finally(() => document.documentElement.classList.remove('reuse-transition'));
}
function renderCapture(type) {
  const draft = senseDraft;
  main.innerHTML = `<div class="wrap view" data-node-id="20:291">
    ${backLink(route('sense-select',type),'Back to Sense Selection')}
    <h1 class="entries-status">Capture New Senses</h1>
    <form id="capture-sense" class="sense-capture-form">
      <div class="capture-models" aria-hidden="true"></div><p id="capture-detected" class="entries-status" aria-live="polite"></p>
      <p class="sense-capture-prompt">Describe your sensory experience.<small id="capture-hint">Try words like “smell,” “taste,” “touch,” “hear,” or “see” to help identify your senses.</small></p>
      <div class="sense-writing-paper">
        <div class="field"><label for="capture-detail">What did you notice?</label><textarea id="capture-detail" aria-describedby="capture-hint" name="detail" placeholder="Describe the moment…" maxlength="220" required>${esc(draft?.detail || '')}</textarea></div>
      </div>
      <button type="submit" class="btn flow-continue">Continue ${icon('arrow')}</button>
    </form>
  </div>`;
  updateCaptureModels();
}
function detectSenses(text) {
  const cues = {
    nose:/\b(smell\w*|scent\w*|aroma\w*|fragranc\w*|perfume|incense|lavender|orange peel|musty|petrichor)\b/gi,
    ears:/\b(hear\w*|heard|sound\w*|music|song\w*|voice\w*|whisper\w*|loud|quiet|silence|ringing|rustl\w*|humming|echo\w*)\b/gi,
    hand:/\b(touch\w*|felt|feel\w*|soft|rough|smooth|warm\w*|cold|cool|hot|texture\w*|skin|hands?|fuzzy|silk\w*|wet|dry|velvet\w*)\b/gi,
    eyes:/\b(see|seeing|saw|look\w*|watch\w*|light\w*|colou?r\w*|bright|dark|glow\w*|blue|red|green|pink|yellow|shadow\w*|sunset|shimmer\w*)\b/gi,
    lips:/\b(tast\w*|flavo[u]?r\w*|sweet|sour|bitter|salty|spicy|savou?ry|delicious|sip\w*|eat\w*|ate|tongue|honey|sugar|lemon)\b/gi
  };
  return Object.entries(cues).map(([type,pattern]) => [type,(text.match(pattern) || []).length]).filter(([,score]) => score).sort((a,b) => b[1]-a[1]).map(([type]) => type);
}
function updateCaptureModels() {
  const input = document.querySelector('#capture-detail');
  const container = document.querySelector('.capture-models');
  if (!input || !container) return;
  const types = detectSenses(input.value);
  const key = [...types].sort().join(',');
  if (container.dataset.detected === key) return;
  container.dataset.detected = key;
  const order = (container.dataset.order || '').split(',').filter(type => types.includes(type));
  order.push(...types.filter(type => !order.includes(type)));
  container.dataset.order = order.join(',');
  container.innerHTML = order.map((type,index) => `<div class="capture-model capture-model-${type}" style="--capture-row:${Math.floor(index / 2)}"><canvas class="sense-model" data-sense-model="${type}"></canvas><small>${senses[type][0]}</small></div>`).join('');
  document.querySelector('#capture-detected').textContent = types.length ? 'Senses noticed: ' + types.map(type => senses[type][0]).join(', ') : '';
  if (types.length) window.KaoruSenses.mount(container);
}
function senseArtwork(types) {
  types = [...new Set(types)].filter(type => Object.hasOwn(senses,type));
  return `<div class="sense-artwork" data-types="${types.join(',')}" tabindex="0" role="group" aria-label="Sensory sphere. Scroll sideways, drag, or use left and right arrow keys to browse its sense models.">
    <div class="sense-orbit">${types.map((type,index) => `<div class="sense-orbit-anchor" style="--slot:${index * 360 / types.length}deg"><span class="sense-orbit-model" role="img" aria-label="${senses[type][0]}"><canvas class="sense-model" data-sense-model="${type}" aria-hidden="true"></canvas></span></div>`).join('')}</div>
  </div>`;
}
function renderSenseNaming() {
  if (!senseDraft) { renderCapture(''); return; }
  const memories = state.entries.filter(entry => entry.status === 'saved').sort(byDate);
  main.innerHTML = `<div class="wrap view sense-naming-view" data-node-id="27:530">
    ${backLink(route('capture',senseDraft.type),'Back to capture')}
    <h1 class="entries-status">Name your sense</h1>
    <div class="sense-naming-scene">
      ${senseArtwork(senseDraft.types || [senseDraft.type])}
      <form id="name-sense" class="sense-naming-form">
        <div class="field"><label for="capture-name">Sense name</label><input id="capture-name" name="name" placeholder="Wet pavement, warm linen…" maxlength="55" required></div>
        <div class="field"><label for="sense-memory-detail">Sensory memory</label><textarea id="sense-memory-detail" name="detail" maxlength="220" required>${esc(senseDraft.detail)}</textarea></div>
        <details class="sense-memory-import">
          <summary>Import memories ${icon('arrow')}</summary>
          <div class="field"><label for="sense-memory">Link a saved diary entry</label>
            <select id="sense-memory" name="memory"><option value="">Choose a memory</option>${memories.map(entry => `<option value="${esc(entry.id)}">${esc(entry.title || 'Untitled memory')}</option>`).join('')}</select>
          </div>
        </details>
        <button type="submit" class="btn flow-continue">Save sense ${icon('arrow')}</button>
      </form>
    </div>
  </div>`;
}
function renderReuseSenses() {
  const notes = senseRecords();
  main.innerHTML = `<div class="wrap view">
    ${backLink('#sense-select','Back to Sense Selection')}
    ${viewTitle('Return to a detail','Reuse a Sense','Choose a captured sense or a scent from your diary.')}
    ${notes.length ? `<div class="index-grid">${notes.map(note => `<a class="index-card sense-record" href="${route('captured',note.id)}"><div><p class="eyebrow">${senses[note.type]?.[0] || 'Memory'}</p><h3>${esc(note.name)}</h3></div>${icon('arrow')}</a>`).join('')}</div>` : empty('No senses yet','Capture a detail to find it here.',backLink('#capture','Capture a sense'))}
  </div>`;
}
function renderCaptured(id) {
  const note = senseRecords().find(item => item.id === id);
  main.innerHTML = `<div class="wrap view choice-view sense-result-view" data-node-id="24:457">
    ${backLink('#sense-select','Back to Sense Selection')}
    ${note ? `${senseArtwork(note.types || [note.type])}
      <div class="captured-sense"><h1>${note.detail ? 'Senses captured.' : 'Sense ready.'}</h1><p class="captured-sense-name">${esc(note.name)}</p>
        ${note.detail ? `<p>${esc(note.detail)}</p>` : ''}
        ${note.memoryId ? `<a href="${route('entry',note.memoryId)}" class="btn link">Open linked memory ${icon('arrow')}</a>` : ''}
      </div>
      <a class="btn flow-continue" href="${route('create',note.id)}">Continue to Create New ${icon('arrow')}</a>`
    : empty('Sense unavailable','Choose a saved sense or capture a new one.') }
  </div>`;
}
function openEntry(id, tab) {
  detailId = id;
  detailTab = tab;
  go('entry',id);
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
    : `<p class="entry-text ${detailTab === 'poem' ? 'poetry' : 'journal-text'}">${esc(entry[detailTab])}</p>`;
  main.innerHTML = `<div class="wrap view">${backLink('#diary')}
    ${viewTitle(dateLabel(entry.created),entry.title || 'Untitled memory')}
    <div class="detail-grid${detailTab !== 'scene' ? ' detail-reading' : ''}">${detailTab === 'scene' ? scene(entry,true) : ''}
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
  journal:['Journal','Write or import a memory','journal'],
  poem:['Poem','Write or import your lines','poem'],
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
  return `<section class="panel flow-write-panel"${active.mode === 'images' ? '' : ` data-node-id="${active.mode === 'journal' ? '27:496' : '27:516'}"`}>
    <div class="mode-grid" aria-label="How to start">${Object.entries(modes).map(([value,[title,hint]]) => `<button class="mode" type="button" data-action="mode" data-value="${value}" aria-pressed="${active.mode===value}"><strong>${title}</strong><small>${hint}</small></button>`).join('')}</div>
    ${attachmentLinks(active)}
    ${field('title','Page title',active.title,{placeholder:'Give this memory a name',max:90})}
    ${field(key,active.mode === 'images' ? 'Image prompt' : label,active[key],{placeholder:prompts[active.mode],area:true,tall:true})}
    ${active.mode !== 'images' ? `<label class="flow-import">${icon('up')}<span>Import a text file</span><input id="import-writing" type="file" accept=".txt,.md,text/plain,text/markdown"></label>` : ''}
    ${active.senseDetail ? `<p class="sense-carry">${esc(active.senseDetail)}</p>` : ''}
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
    ${attachmentLinks(active)}
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
    <section class="panel"><p class="eyebrow">Live preview</p><div id="collage-preview">${scene(active,true)}</div></section>
    <section class="panel">
      <h3>Arrange your page</h3>
      ${field('title','Title',active.title,{placeholder:'Untitled memory',max:90})}
      ${field('poem','Poem lines',active.poem,{placeholder:'Optional text to place on the page',area:true,max:2000})}
      ${field('note','Handwritten note',active.note,{placeholder:'Something to keep in the margin',max:110})}
      <fieldset class="field"><legend>Layout</legend><div class="actions">${optionChips('layout',[['layered','Layered'],['split','Split'],['quiet','Quiet']])}</div></fieldset>
      <fieldset class="field"><legend>Paper color</legend><div class="actions">${optionChips('tint',[['sand','Sand'],['ash','Sage'],['rose','Clay']])}</div></fieldset>
      ${field('scent','Scent label',active.scent,{placeholder:'Optional',max:55})}
      ${active.scent ? `<div class="field"><label><input type="checkbox" data-field="showScent" ${active.showScent ? 'checked' : ''}> Show scent label on collage</label></div>` : ''}
      ${photos(active).map((item,i,list) => `<div class="layer-row">
        <details class="photo-settings"><summary>${i+1}. ${esc(item.name)}</summary>
          <label class="field" for="photo-crop-${esc(item.id)}">Shift photo crop<input id="photo-crop-${esc(item.id)}" type="range" min="0" max="100" value="${photoCrop(active,item.id)}" data-photo-crop="${esc(item.id)}"></label>
        </details>
        ${iconButton('move-up','Move image earlier',item.id,'up',i===0)}${iconButton('move-down','Move image later',item.id,'down',i===list.length-1)}${iconButton('remove-layer','Remove from collage',item.id,'cross')}
      </div>`).join('')}
      <div class="editor-actions">
        <div class="actions">${button('step-back','Images','ghost','','back')}${button('save-draft','Save & exit','ghost')}</div>
        ${button('save-scene','Save scene','primary','','arrow')}
      </div>
    </section>
  </div>`;
}
const journalFileExtensions = ['txt','md','markdown','doc','docx','rtf','odt'];
function renderWritingChoice() {
  const uploading = active.stage === 'import';
  const label = active.mode === 'images' ? 'Collages' : active.mode === 'poem' ? 'Poem' : 'Journal';
  const files = active.sourceFiles?.length ? active.sourceFiles : active.mode === 'images' ? active.uploads : [];
  main.innerHTML = `<div class="wrap view writing-choice-view">
    ${uploading ? button('writing-choice','Back to choices','link','','back') : backLink('#create','Back to Create New')}
    <div class="writing-object-scene${uploading && !files.length ? ' upload-centered' : ''}">
      <h1>${label}</h1>
      ${uploading ? '' : `<button class="writing-object" data-action="writing-prompt"><canvas class="sense-model" data-sense-model="typewriter" aria-hidden="true"></canvas><span>Write Prompt</span></button>`}
      ${uploading ? `<div class="writing-object upload-object"><label class="upload-model"><canvas class="sense-model" data-sense-model="folder" aria-hidden="true"></canvas><input aria-label="Upload files" id="choice-upload" type="file" ${active.mode === 'journal' ? `accept="${journalFileExtensions.map(ext=>`.${ext}`).join(',')}"` : ''} multiple></label><span>Upload</span></div>` : `<button class="writing-object" data-action="writing-upload"><canvas class="sense-model" data-sense-model="folder" aria-hidden="true"></canvas><span>Upload</span></button>`}
      ${uploading && files.length ? `<div class="imported-papers" role="region" tabindex="0" aria-label="Uploaded file previews. Scroll to browse.">${files.map(file=>`<article class="imported-paper">${file.src ? `<img src="${esc(file.src)}" alt="${esc(file.name)}">` : `<p>${esc(file.preview || 'Original file attached.')}</p>`}<span>${esc(file.name)}</span></article>`).join('')}</div>` : ''}
    </div>
    ${uploading ? `<button class="btn flow-continue" data-action="writing-open" ${files.length ? '' : 'disabled'}>Continue ${icon('arrow')}</button>` : ''}
  </div>`;
  window.KaoruSenses.mount(main.querySelector('.writing-object-scene'));
  const wheel = main.querySelector('.imported-papers');
  if (wheel) {
    const shape = () => {
      const bounds = wheel.getBoundingClientRect(), center = bounds.top + wheel.clientHeight / 2;
      wheel.querySelectorAll('.imported-paper').forEach(card => {
        const rect = card.getBoundingClientRect();
        const distance = Math.max(-1,Math.min(1,(rect.top + rect.height/2 - center)/(wheel.clientHeight/2)));
        card.style.transform = `translateX(${-12*distance*distance}px) rotate(${distance*8}deg) scale(${1-Math.abs(distance)*.12})`;
        card.style.opacity = 1-Math.abs(distance)*.35;
      });
    };
    wheel.addEventListener('scroll',shape,{passive:true});
    requestAnimationFrame(shape);
  }
}
let attachmentDatabase;
function openAttachments() {
  if (!attachmentDatabase) attachmentDatabase = new Promise((resolve,reject) => {
    const request = indexedDB.open('kaoru-attachments',1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { attachmentDatabase = null; reject(request.error); };
  });
  return attachmentDatabase;
}
async function storeAttachments(items) {
  const db = await openAttachments();
  return new Promise((resolve,reject) => {
    const transaction = db.transaction('files','readwrite');
    for (const item of items) transaction.objectStore('files').put(item.file,item.id);
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}
async function downloadAttachment(id) {
  try {
    const db = await openAttachments();
    const file = await new Promise((resolve,reject) => {
      const request = db.transaction('files').objectStore('files').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!file) { message('This attachment is not available in this browser.'); return; }
    const url = URL.createObjectURL(file), link = document.createElement('a');
    link.href = url; link.download = file.name; link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  } catch { message('This attachment could not be opened.'); }
}
function attachmentLinks(entry) {
  const files = (entry.sourceFiles || []).filter(file=>file.id);
  return files.length ? `<div class="attachment-links" aria-label="Attached files">${files.map(file=>button('download-attachment',file.name,'ghost',file.id)).join('')}</div>` : '';
}
async function importChoiceFiles(input) {
  const target = active, key = modes[target.mode][2], files = [...input.files];
  if (!files.length) return;
  if (target.mode === 'journal' && files.some(file => !journalFileExtensions.some(ext => file.name.toLowerCase().endswith(`.${ext}`)))) {
    message('Please upload text documents: TXT, Markdown, DOC, DOCX, RTF, or ODT.');
    input.value = '';
    return;
  }
  input.disabled = true;
  try {
    const items = await Promise.all(files.map(async file => {
      const id=makeId(), note={id,name:file.name,type:file.type,size:file.size};
      let text='', image;
      if (file.type.startsWith('text/') || /\.(txt|md|markdown|csv|json|log)$/i.test(file.name)) {
        text = (await file.slice(0,65536).text()).trim();
        note.preview = text.slice(0,200);
      } else if (file.type.startsWith('image/')) {
        try { image=await resizeImage(file); note.src=image.src; } catch { /* Keep the original even when a thumbnail cannot be decoded. */ }
      }
      if (!note.preview && !note.src) note.preview = `${file.name.split('.').pop().toUpperCase()} file · Original attached`;
      return {id,file,note,text,image};
    }));
    if (active !== target) return;
    await storeAttachments(items);
    if (active !== target) return;
    const previous={sourceFiles:target.sourceFiles,uploads:[...target.uploads],selected:[...target.selected],[key]:target[key]};
    target.sourceFiles=[...(target.sourceFiles || []),...items.map(item=>item.note)];
    const text=items.map(item=>item.text).filter(Boolean).join('\n\n');
    const combined=[target[key],text].filter(Boolean).join('\n\n');
    if (text && combined.length<=2400 && target.mode!=='images') target[key]=combined;
    if (target.mode==='images') {
      const pictures=items.map(item=>item.image).filter(Boolean).slice(0,Math.max(0,5-target.uploads.length));
      target.uploads.push(...pictures);
      target.selected.push(...pictures.slice(0,Math.max(0,3-target.selected.length)).map(item=>item.id));
    }
    if (!rememberDraft()) Object.assign(target,previous);
    render();
  } catch { message('The files could not be saved. Check available browser storage and try again.'); }
  finally { input.disabled=false; input.value=''; }
}

function setJournalFocus(expanded) {
  const sheet = main.querySelector('.journal-writing-sheet');
  if (!sheet) return;
  const view = sheet.closest('.journal-flow-view');
  if (view.classList.contains('is-writing-focus') === expanded) return;
  const before = sheet.getBoundingClientRect();
  view.classList.toggle('is-writing-focus',expanded);
  const after = sheet.getBoundingClientRect();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) sheet.animate([
    {transform:`translate(${before.left-after.left}px,${before.top-after.top}px) scale(${before.width/after.width},${before.height/after.height})`},
    {transform:'none'}
  ],{duration:600,easing:'cubic-bezier(.22,.61,.36,1)'});
  view.querySelector('.journal-flow-footer').inert = expanded;
  view.querySelector('.journal-flow-next').inert = expanded;
}
function renderJournalFlow() {
  const stage = active.stage;
  const editing = stage === 'poem-edit';
  const poem = stage === 'poem' || editing;
  const date = active.journalDate || active.created.slice(0,10);
  const metadataIcons = {Sunny:'☀️',Cloudy:'☁️',Rainy:'🌧️',Snowy:'❄️',Windy:'🌬️',Foggy:'🌫️',Stormy:'⛈️',Happy:'😊',Calm:'😌',Grateful:'🥰',Excited:'🤩',Reflective:'🤔',Tired:'😴',Sad:'😔',Anxious:'😟',Frustrated:'😤',Mixed:'😶'};
  const metadataOptions = (field, choices) => {
    const value = active[field] || '';
    const options = value && !choices.includes(value) ? [value,...choices] : choices;
    return `<div class="metadata-selector"><button type="button" class="metadata-arrow" data-step="-1" aria-label="Previous ${field}">‹</button><div class="metadata-wheel" role="group" aria-label="${field === 'weather' ? 'Weather' : 'Feeling'}" data-metadata="${field}">${options.map(option => `<button type="button" data-value="${esc(option)}" aria-label="${esc(option)}" title="${esc(option)}" aria-pressed="${option === value}">${metadataIcons[option] || esc(option)}</button>`).join('')}</div><button type="button" class="metadata-arrow" data-step="1" aria-label="Next ${field}">›</button></div>`;
  };
  main.innerHTML = `<div class="wrap view journal-flow-view">
    ${button('journal-back','Back','link','','back')}
    <div class="journal-flow-scene">
      <h1>${poem ? 'Poem' : 'Journal'}</h1>
      ${stage === 'start' ? `<section class="journal-writing-sheet" aria-label="Write journal">
        <input aria-label="Journal title" data-field="title" maxlength="90" placeholder="Journal Title" value="${esc(active.title)}">
        <div class="journal-metadata">
          <label>Date<input aria-label="Date" type="date" data-field="journalDate" value="${esc(date)}"></label>
          <div class="metadata-field"><span>Weather</span>${metadataOptions('weather',['Sunny','Cloudy','Rainy','Snowy','Windy','Foggy','Stormy'])}</div>
          <div class="metadata-field"><span>Feeling</span>${metadataOptions('feeling',['Happy','Calm','Grateful','Excited','Reflective','Tired','Sad','Anxious','Frustrated','Mixed'])}</div>
        </div>
        <button type="button" class="journal-focus-done" data-action="journal-focus-done">Done writing</button>
        <textarea id="journal" aria-label="Journal content" data-field="journal" maxlength="2400" placeholder="Journal content…">${esc(active.journal)}</textarea>
      </section>` : stage === 'journal-choice' ? `<div class="journal-paths" aria-label="Choose what to create">
        <button class="journal-path is-selected" data-action="journal-path" data-value="poem" aria-pressed="true">Generate<br>poem?</button>
        <button class="journal-path" data-action="journal-path" data-value="images" aria-pressed="false">Skip to<br>image</button>
      </div>` : `<div class="journal-poem-preview">${editing ? `<textarea aria-label="Edit poem" data-field="poem" maxlength="2000">${esc(active.poem)}</textarea>` : `<p class="poem-reveal" aria-label="${esc(active.poem)}"></p>`}</div>`}
      <div class="journal-flow-next">
        ${poem ? button(editing ? 'journal-finish-edit' : 'journal-edit-poem',editing ? 'Done' : 'edit?','link') : ''}
        ${iconButton(stage === 'start' ? 'journal-next' : stage === 'journal-choice' ? 'journal-generate' : 'approve-poem','Continue','','arrow')}
      </div>
    </div>
    <div class="journal-flow-footer"><div class="journal-save-options">
      <button type="button" class="journal-save-final" data-action="${poem ? 'save-poem' : 'save-note'}"><span>${poem ? 'Save poem' : 'Save journal'}</span></button>
      <button type="button" class="journal-save-draft" data-action="save-draft"><span>Save draft & exit</span></button>
    </div></div>
  </div>`;
  main.querySelectorAll('.metadata-wheel').forEach(wheel => {
    const options = [...wheel.children];
    const arrows = [...wheel.parentElement.querySelectorAll('.metadata-arrow')];
    const select = option => {
      options.forEach(item => item.setAttribute('aria-pressed',String(item === option)));
      arrows[0].disabled = option === options[0];
      arrows[1].disabled = option === options.at(-1);
      active[wheel.dataset.metadata] = option.dataset.value;
      rememberDraft();
    };
    const position = option => option.offsetLeft - options[0].offsetLeft;
    wheel.scrollLeft = position(wheel.querySelector('[aria-pressed="true"]') || options[0]);
    arrows[0].disabled = options[0].getAttribute('aria-pressed') === 'true';
    arrows[1].disabled = options.at(-1).getAttribute('aria-pressed') === 'true';
    const step = direction => {
      const current = options.findIndex(option => option.getAttribute('aria-pressed') === 'true');
      options[Math.max(0,Math.min(options.length-1,current+direction))].click();
    };
    arrows.forEach(arrow => arrow.addEventListener('click', () => step(Number(arrow.dataset.step))));
    wheel.addEventListener('keydown', event => {
      if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault();
      step(event.key === 'ArrowRight' ? 1 : -1);
    });
    let settle;
    wheel.addEventListener('scroll', () => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        if (!wheel.isConnected) return;
        select(options.reduce((nearest,item) => Math.abs(position(item)-wheel.scrollLeft) < Math.abs(position(nearest)-wheel.scrollLeft) ? item : nearest));
      },100);
    },{passive:true});
    options.forEach(option => option.addEventListener('click', () => {
      select(option);
      wheel.scrollTo({left:position(option),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
    }));
  });
  if (stage === 'poem') {
    const output = main.querySelector('.poem-reveal'), text = active.poem;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { output.textContent = text; return; }
    const start = performance.now();
    const reveal = time => {
      if (!output.isConnected) return;
      const count = Math.floor((time-start)/24);
      output.textContent = text.slice(0,count);
      if (count < text.length) requestAnimationFrame(reveal);
    };
    requestAnimationFrame(reveal);
  }
}
async function showGenerating(kind) {
  const target = active, destination = location.hash;
  const words = [target.scent,...(target.journal+' '+target.prompt+' '+target.poem).match(/[a-zA-Z]{4,}/g) || []]
    .filter(word => word && !/^(this|that|with|from|have|were|there|then|when)$/i.test(word));
  const keywords = [...new Set(words.map(word=>word.toLowerCase()))].slice(0,3);
  main.innerHTML = `<div class="wrap view generating-view" aria-busy="true">
    <div class="generation-orb" aria-hidden="true">${keywords.map((word,i)=>`<span class="generation-keyword keyword-${i}">${esc(word)}</span>`).join('')}</div>
    <h1 role="status">Generating…</h1><p class="demo-note">${kind === 'poem' ? 'Creating a sample poem' : 'Preparing sample images'}</p>
  </div>`;
  await new Promise(resolve=>setTimeout(resolve,1600));
  if (active !== target || location.hash !== destination) return;
  if (kind === 'poem') { draftPoem(); active.skippedPoem=false; advance('poem'); }
  else { imageIdeas(); advance('media'); }
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
  if (active.stage === 'choose' || active.stage === 'import') { renderWritingChoice(); return; }
  if (active.mode === 'journal' && ['start','journal-choice','poem','poem-edit'].includes(active.stage)) { renderJournalFlow(); return; }
  const config = {
    start:active.mode === 'journal' ? ['Journal','Write a memory or import a text file.',startPanel]
      : active.mode === 'poem' ? ['Poem','Write your lines or bring in a poem of your own.',startPanel]
      : ['Collage','Begin with a visual idea.',startPanel],
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
  if (page === 'create') renderCreate(id);
  else if (page === 'sense-select') renderSenseSelect(id);
  else if (page === 'capture') renderCapture(id);
  else if (page === 'name-sense') renderSenseNaming();
  else if (page === 'reuse-sense') renderReuseSenses();
  else if (page === 'captured') renderCaptured(id);
  else if (page === 'edit') renderWizard(id);
  else if (page === 'entry') renderDetail(id);
  else if (page === 'scents') renderIndex();
  else if (page === 'scent') renderScent(id);
  else if (page === 'saved') renderSaved();
  else renderDiary();
  const sphere = main.querySelector('.sense-artwork');
  if (sphere?.querySelector('.sense-model')) window.KaoruSenses.mount(sphere);
  if (focus) { window.scrollTo(0,0); main.focus({preventScroll:true}); }
  if (pendingSceneEdit) {
    const selection = pendingSceneEdit;
    pendingSceneEdit = null;
    if (page === 'edit' && active?.editOf === selection.entryId) focusSceneEditor(selection);
  }
}
function newDraft(values = {}) {
  if (active && !rememberDraft()) return;
  active = {...fresh(), ...values};
  go('edit',active.id);
}
function beginCreation(form) {
  const mode = new FormData(form).get('start');
  const reference = form.dataset.reference;
  const note = senseRecords().find(item => item.id === reference);
  const sense = note?.type || (Object.hasOwn(senses,reference) ? reference : '');
  if (mode === 'senses') {
    senseDraft = null;
    go('sense-select',sense);
    return;
  }
  const values = {mode,sense,stage:'choose'};
  if (note?.type === 'nose') {
    values.scent = note.name;
    values.smell = note.detail;
  } else if (note) {
    values.senseDetail = note.detail;
  }
  if (note?.memoryId) values.parentId = note.memoryId;
  if (mode === 'images') {
    values.skippedPoem = true;
  }
  newDraft(values);
}
function captureSense(form) {
  const fields = new FormData(form);
  const detail = fields.get('detail').trim();
  const types = detectSenses(detail);
  if (!detail) {
    message('Describe what you noticed.');
    return;
  }
  senseDraft = {type:types[0] || '',types,detail};
  go('name-sense');
}
function saveSense(form) {
  const fields = new FormData(form);
  const name = fields.get('name').trim();
  const detail = fields.get('detail').trim();
  if (!name || !detail) { message('Add a name and a detail for this sense.'); return; }
  const types = detectSenses(detail);
  const note = {id:makeId(),type:types[0] || '',types,name,detail};
  const memory = itemById(fields.get('memory'));
  if (memory?.status === 'saved') note.memoryId = memory.id;
  if (persist({...state,senseNotes:[note,...(state.senseNotes || [])]})) {
    senseDraft = null;
    go('captured',note.id);
  }
}
function advance(stage) {
  const previous = active.stage;
  active.stage = stage;
  if (!rememberDraft()) { active.stage = previous; return; }
  render(true);
}
function draftPoem() {
  const source = active.journal.trim().split(/[.!?\n]/)[0].split(/\s+/).slice(0,10).join(' ');
  const scent = (active.smell.trim() || active.scent.trim()).replace(/[.!?]+$/,'');
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
  const text = normalize([active.scent,active.smell,active.senseDetail,active.prompt,active.journal,active.poem].join(' '));
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
function editSaved(id,openCollage = false) {
  const entry = itemById(id);
  const existing = state.entries.find(draft => draft.status === 'draft' && draft.editOf === id);
  if (existing) {
    if (openCollage) { active = structuredClone(existing); active.stage = 'collage'; }
    go('edit',existing.id);
    return;
  }
  newDraft({...structuredClone(entry),id:makeId(),status:'draft',editOf:id,stage:entry.kind ? 'media' : 'collage',skippedPoem:!entry.poem,updated:now()});
}
function focusSceneEditor({kind,key}) {
  const field = document.getElementById(kind === 'image' ? 'photo-crop-' + key : kind);
  if (!field) { message('This piece is unavailable in the current draft.'); return; }
  const options = field.closest('details');
  if (options) options.open = true;
  field.focus();
}
function selectScenePiece(piece) {
  const previous = document.querySelector('.scene-piece.is-selected');
  const update = (layer,shown) => {
    layer.classList.toggle('is-selected',shown);
    layer.querySelector('.scene-piece-trigger').setAttribute('aria-expanded',String(shown));
    layer.querySelector('.scene-piece-edit').hidden = !shown;
  };
  if (previous) update(previous,false);
  if (piece && piece !== previous) update(piece,true);
  return previous;
}
function editScenePiece(piece) {
  const {kind,key} = piece.dataset;
  const entryId = piece.closest('.scene-art').dataset.sceneEntry;
  if (active?.id === entryId) {
    focusSceneEditor({kind,key});
  } else {
    pendingSceneEdit = {entryId,kind,key};
    editSaved(entryId,true);
  }
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
async function importWriting(input) {
  const file = input.files[0];
  const target = active;
  if (!file || !target || target.mode === 'images') return;
  const key = modes[target.mode][2];
  const field = document.getElementById(key);
  if (file.size > 64 * 1024) {
    message('Choose a smaller text file for this page.');
    input.value = '';
    return;
  }
  try {
    const text = (await file.text()).trim();
    if (active !== target || !field.isConnected) return;
    const combined = [field.value.trimEnd(),text].filter(Boolean).join('\n\n');
    if (!text || combined.length > field.maxLength) {
      message(text ? 'This text is too long for the writing field.' : 'The file has no text to import.');
      return;
    }
    target[key] = field.value = combined;
    if (rememberDraft()) message('Text imported.');
    field.focus();
  } catch {
    message('This file could not be read. Try a plain text file.');
  } finally {
    input.value = '';
  }
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
  'download-attachment':id => { void downloadAttachment(id); },
  'writing-choice':() => { active.stage='choose'; render(); },
  'writing-upload':() => {
    const open = () => { active.stage='import'; render(); };
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { open(); return; }
    if (document.documentElement.classList.contains('upload-transition')) return;
    document.documentElement.classList.add('upload-transition');
    const transition = document.startViewTransition(open);
    transition.finished.finally(() => document.documentElement.classList.remove('upload-transition'));
  },
  'writing-prompt':() => { active.stage='start'; render(); },
  'writing-open':() => { active.stage=active.mode === 'images' ? 'media' : 'start'; rememberDraft(); render(); },
  'poem-page':turnPoemPage,
  'show-sense-wheel':showSenseWheel,
  new:() => newDraft(),
  'home-view':value => selectHomeView(Number(value)),
  'home-turn':value => rotateHome(Number(value)),
  'pick-sense':selectSense,
  'new-from-sense':() => go('create',homeSense),
  'new-scent':scent => newDraft({scent}),
  filter:value => {
    filter = value;
    deckEntryId = '';
    document.querySelectorAll('[data-action="filter"]').forEach(control => control.setAttribute('aria-pressed',control.dataset.value === value));
    renderEntries();
  },
  'deck-select':selectDeckEntry,
  'open-search':() => setSearchExpanded(document.querySelector('#entries-search'),true),
  'clear-search':() => {
    query = '';
    deckEntryId = '';
    document.querySelector('#search').value = '';
    renderEntries();
    setSearchExpanded(document.querySelector('#entries-search'),true);
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
  'entry-collage':id => openEntry(id,'scene'),
  'entry-journal':id => openEntry(id,'journal'),
  'entry-poem':id => openEntry(id,'poem'),
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
  'journal-focus-done':() => { setJournalFocus(false); main.querySelector('#journal')?.focus({preventScroll:true}); },
  'journal-back':() => { advance(({start:'choose','journal-choice':'start',poem:'journal-choice','poem-edit':'poem'})[active.stage] || 'start'); },
  'journal-next':() => { if (requireText('journal','Write a few words first.')) advance('journal-choice'); },
  'journal-path':value => {
    main.querySelectorAll('.journal-path').forEach(item => {
      const selected = item.dataset.value === value;
      item.classList.toggle('is-selected',selected);
      item.setAttribute('aria-pressed',String(selected));
    });
  },
  'journal-generate':() => {
    if (main.querySelector('.journal-path.is-selected')?.dataset.value === 'images') { active.skippedPoem=true; advance('media'); }
    else void showGenerating('poem');
  },
  'journal-edit-poem':() => advance('poem-edit'),
  'journal-finish-edit':() => advance('poem'),
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
  'generate-images':() => { void showGenerating('images'); },
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
  if (event.target.matches('#create-flow input[name="start"]')) { beginCreation(event.target.form); return; }
  const trigger = event.target.closest('.scene-piece-trigger');
  if (trigger) { selectScenePiece(trigger.parentElement); return; }
  const edit = event.target.closest('.scene-piece-edit');
  selectScenePiece(null);
  if (edit) { editScenePiece(edit.parentElement); return; }
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
  if (event.target.id === 'journal' && event.target.closest('.journal-writing-sheet')) setJournalFocus(true);
  if (event.target.matches('.journal-writing-sheet textarea') && !event.isComposing && event.inputType === 'insertText' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    event.target.getAnimations().forEach(animation => animation.cancel());
    event.target.animate([{transform:'translateY(.7px)'},{transform:'translateY(0)'}],{duration:130,easing:'ease-out'});
  }
  if (event.target.id === 'capture-detail') updateCaptureModels();
  if (event.target.id === 'sense-memory-detail') {
    const types = detectSenses(event.target.value);
    const sphere = main.querySelector('.sense-artwork');
    if (sphere && sphere.dataset.types !== types.join(',')) {
      sphere.outerHTML = senseArtwork(types);
      if (types.length) window.KaoruSenses.mount(main.querySelector('.sense-artwork'));
    }
  }
  if (event.target.id === 'search') { query = event.target.value; deckEntryId = ''; renderEntries(); return; }
  const {field:key,photoCrop:cropId} = event.target.dataset;
  if (!active || (!key && !cropId)) return;
  if (cropId) active.photoCrops = {...active.photoCrops,[cropId]:Number(event.target.value)};
  else active[key] = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
  const preview = document.querySelector('#collage-preview');
  if (preview) preview.innerHTML = scene(active,true);
});
document.addEventListener('change', event => {
  if (event.target.id === 'choice-upload' && active) void importChoiceFiles(event.target);
  if (event.target.id === 'upload' && active) void uploadFiles(event.target.files);
  if (event.target.id === 'import-writing') void importWriting(event.target);
  if (active && (event.target.dataset.field || event.target.dataset.photoCrop)) rememberDraft();
});
document.addEventListener('focusout', event => {
  const form=event.target.closest('.entries-search.is-expanded');
  if (form && !form.contains(event.relatedTarget)) setSearchExpanded(form,false);
});
document.addEventListener('submit', event => {
  if (event.target.id === 'create-flow' || event.target.id === 'capture-sense' || event.target.id === 'name-sense') {
    event.preventDefault();
    if (event.target.id === 'create-flow') beginCreation(event.target);
    else if (event.target.id === 'capture-sense') captureSense(event.target);
    else saveSense(event.target);
    return;
  }
  if (event.target.id !== 'entries-search') return;
  event.preventDefault();
  if (!query.trim()) {
    document.querySelector('#search').focus({preventScroll:true});
    return;
  }
  selectHomeView(0);
  document.querySelector('#entries').focus({preventScroll:true});
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    setJournalFocus(false);
    const piece = selectScenePiece(null);
    if (piece) piece.querySelector('.scene-piece-trigger').focus({preventScroll:true});
  }
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
    !event.target.closest('.entries-search, .sense-tile, .scene-piece') &&
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
document.addEventListener('transitionend', event => {
  if (event.propertyName === 'transform' && event.target.matches('.home-turntable')) {
    event.target.parentElement.classList.remove('is-turning');
  }
});
window.addEventListener('hashchange', () => render(true));
window.addEventListener('pagehide', () => { if (active) rememberDraft(); });
render();


let sphereFadeTimer;
function turnSenseSphere(sphere,amount) {
  sphere.classList.add('is-spinning');
  clearTimeout(sphereFadeTimer);
  sphereFadeTimer = setTimeout(() => sphere.classList.remove('is-spinning'),220);
  const angle = Number(sphere.dataset.rotation || 0) + amount;
  sphere.dataset.rotation = angle;
  sphere.style.setProperty('--turn',angle + 'deg');
  sphere.style.setProperty('--light-x',(50 - Math.cos(angle * Math.PI / 180) * 22) + '%');
}
document.addEventListener('wheel',event => {
  const sphere = event.target.closest('.sense-artwork');
  if (!sphere || event.ctrlKey) return;
  const delta = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
  if (!delta || (!event.shiftKey && Math.abs(delta) < Math.abs(event.deltaY))) return;
  event.preventDefault();
  turnSenseSphere(sphere,-delta * (event.deltaMode === 1 ? 8 : .45));
},{passive:false});
document.addEventListener('keydown',event => {
  const sphere = event.target.closest('.sense-artwork');
  if (!sphere || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  turnSenseSphere(sphere,event.key === 'ArrowRight' ? -120 : 120);
});
let sphereDrag = null;
document.addEventListener('pointerdown',event => {
  const sphere = event.target.closest('.sense-artwork');
  if (!sphere || event.button !== 0) return;
  sphereDrag = {sphere,x:event.clientX,id:event.pointerId};
  sphere.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove',event => {
  if (!sphereDrag || sphereDrag.id !== event.pointerId) return;
  turnSenseSphere(sphereDrag.sphere,(event.clientX - sphereDrag.x) * .6);
  sphereDrag.x = event.clientX;
});
['pointerup','pointercancel','lostpointercapture'].forEach(type => document.addEventListener(type,() => { sphereDrag = null; }));

function showWelcome() {
  if (location.hash && location.hash !== '#diary') return;
  try { if (localStorage.getItem('kaoru-hide-welcome') === 'true') return; } catch {}
  const welcome = document.createElement('dialog');
  welcome.className = 'welcome-screen';
  welcome.setAttribute('aria-labelledby','welcome-title');
  welcome.innerHTML = `<div class="welcome-center"><h1 id="welcome-title">Kaoru</h1><p class="welcome-slogan">keep what lingers</p>
    <div class="welcome-tip" hidden><p>Scroll sideways to move between<br>All entries, Senses, and Create New.</p><p class="welcome-alternative">You can also use the on-screen arrows.</p>
    <label><input type="checkbox" id="welcome-hide"> Don’t show again</label>
    <button type="button" class="btn" id="welcome-enter">Enter diary ${icon('arrow')}</button></div></div>`;
  document.body.append(welcome);
  welcome.showModal();
  const timer = setTimeout(() => {
    welcome.querySelector('.welcome-tip').hidden = false;
    welcome.classList.add('is-ready');
    welcome.querySelector('#welcome-enter').focus({preventScroll:true});
  },3500);
  welcome.addEventListener('keydown',event => event.stopPropagation());
  welcome.addEventListener('wheel',event => event.stopPropagation());
  welcome.querySelector('#welcome-enter').addEventListener('click',() => welcome.close());
  welcome.addEventListener('close',() => {
    clearTimeout(timer);
    if (welcome.querySelector('#welcome-hide').checked) {
      try { localStorage.setItem('kaoru-hide-welcome','true'); } catch {}
    }
    welcome.remove();
  },{once:true});
}
showWelcome();
