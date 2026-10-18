// Orquestación: estado de la app y eventos. Conecta api → logic → render.
import './style.css';
import { PAGE_SIZE, getPokedexEntry, getPokemonPage, getTypes } from './api.js';
import { clearCache } from './cache.js';
import {
  computeQuartiles,
  filterPokemon,
  mergeById,
  sortPokemon,
  summarize,
  toViewModel,
} from './logic.js';
import { renderGrid, renderStatus, renderSummary, renderTypeOptions } from './render.js';
import { playCry } from './audio.js';

const $ = (selector) => document.querySelector(selector);
const els = {
  controls: $('#controls'),
  search: $('#search'),
  type: $('#type-filter'),
  sort: $('#sort'),
  clearCache: $('#clear-cache'),
  summary: $('#summary'),
  status: $('#status'),
  grid: $('#grid'),
  loadMore: $('#load-more'),
};

const state = {
  all: [],
  offset: 0,
  total: null, // lo rellena la API en la primera página
  loading: false,
  status: { kind: 'idle' },
  query: '',
  type: '',
  sort: 'id',
};

// Se pasa al render para que pida la entrada de la Pokédex al pasar el ratón.
const loadEntry = (pokemon) => getPokedexEntry(pokemon.species);

function update() {
  const visible = sortPokemon(
    filterPokemon(state.all, { query: state.query, type: state.type }),
    state.sort,
  );

  renderGrid(els.grid, visible, computeQuartiles(state.all), loadEntry);
  renderSummary(els.summary, summarize(visible), state.all.length);

  const idleAndEmpty = !state.loading && state.status.kind === 'idle' && visible.length === 0;
  renderStatus(
    els.status,
    idleAndEmpty
      ? {
          kind: 'empty',
          message: state.all.length
            ? 'Ningún Pokémon coincide con la búsqueda. Prueba otro filtro o carga más.'
            : 'No hay Pokémon que mostrar.',
        }
      : state.status,
  );

  const exhausted = state.total !== null && state.offset >= state.total;
  els.loadMore.hidden = exhausted;
  els.loadMore.disabled = state.loading;
  els.loadMore.textContent = state.loading ? 'Cargando…' : 'Cargar más';
}

async function loadMore() {
  if (state.loading) return;
  state.loading = true;
  state.status = { kind: 'loading', message: 'Capturando Pokémon…' };
  update();

  try {
    const { items, failed, total } = await getPokemonPage(state.offset, PAGE_SIZE);
    state.total = total;
    state.all = mergeById(state.all, items.map(toViewModel));
    state.offset += PAGE_SIZE;
    state.status = failed
      ? { kind: 'warning', message: `${failed} Pokémon no se pudieron cargar. El resto sí.` }
      : { kind: 'idle' };
  } catch (error) {
    state.status = { kind: 'error', message: error.message, onRetry: loadMore };
  } finally {
    state.loading = false;
    update();
  }
}

async function loadTypes() {
  try {
    renderTypeOptions(els.type, await getTypes());
  } catch {
    // Los tipos son accesorios: sin ellos el filtro queda en "Todos".
  }
}

const debounce = (fn, ms) => {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), ms);
  };
};

// ---------- Grito del Pokémon al hacer clic ----------
// Un solo addEventListener en el grid (delegación de eventos) sirve para todas las
// cartas, también las que se crean después con "Cargar más" o al filtrar.
function singCry(card) {
  const url = card?.dataset.cry;
  if (!url) return; // algunas formas no tienen grito
  playCry(url);
  card.classList.remove('is-singing');
  void card.offsetWidth; // fuerza un reflow para reiniciar la animación si haces clic seguido
  card.classList.add('is-singing');
}

els.grid.addEventListener('click', (event) => singCry(event.target.closest('.card')));
els.grid.addEventListener('keydown', (event) => {
  if (event.target.matches('.card') && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault(); // evita que la barra espaciadora haga scroll
    singCry(event.target);
  }
});
els.grid.addEventListener('animationend', (event) => event.target.classList.remove('is-singing'));

els.controls.addEventListener('submit', (event) => event.preventDefault());
els.search.addEventListener(
  'input',
  debounce((event) => {
    state.query = event.target.value;
    update();
  }, 200),
);
els.type.addEventListener('change', (event) => {
  state.type = event.target.value;
  update();
});
els.sort.addEventListener('change', (event) => {
  state.sort = event.target.value;
  update();
});
els.loadMore.addEventListener('click', loadMore);
els.clearCache.addEventListener('click', () => {
  clearCache();
  state.status = { kind: 'info', message: 'Caché vaciada. Las próximas cargas irán a la red.' };
  update();
  state.status = { kind: 'idle' };
});

loadTypes();
loadMore();