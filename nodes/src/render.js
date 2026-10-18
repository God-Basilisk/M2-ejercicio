// Render: único módulo que toca el DOM. Usa createElement/textContent (sin innerHTML)
// para que ningún dato de la API pueda inyectar HTML.
import { LEVEL_LABELS, MAX_STAT, STAT_LABELS, statLevel, typeLabel } from './logic.js';

function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value);
  });
  node.append(...children.flat().filter((c) => c != null && c !== false));
  return node;
}

const typeBadge = (type) => h('span', { class: `badge type-${type}` }, typeLabel(type));

const statRow = ({ name, value }, range) => {
  const level = statLevel(value, range);
  const label = STAT_LABELS[name] ?? name;
  return h(
    'li',
    { class: 'stat', title: `${label}: ${value} · ${LEVEL_LABELS[level]}` },
    h('span', { class: 'stat-name' }, label),
    h(
      'span',
      { class: 'stat-bar', role: 'presentation' },
      h('span', {
        class: `stat-fill level-${level}`,
        style: `width:${Math.min(100, (value / MAX_STAT) * 100)}%`,
      }),
    ),
    h('span', { class: 'stat-value' }, String(value)),
  );
};

function sprite(pokemon) {
  if (!pokemon.sprite) return h('div', { class: 'sprite sprite-missing', 'aria-hidden': 'true' }, '?');
  const img = h('img', {
    class: 'sprite',
    src: pokemon.sprite,
    alt: pokemon.label,
    loading: 'lazy',
    width: '120',
    height: '120',
  });
  img.addEventListener('error', () => img.replaceWith(sprite({ ...pokemon, sprite: null })), {
    once: true,
  });
  return img;
}

function entryPanel(pokemon, loadEntry) {
  const genus = h('p', { class: 'entry-genus' });
  const text = h('p', { class: 'entry-text' }, 'Consultando la Pokédex…');
  const panel = h(
    'div',
    { class: 'entry' },
    h('span', { class: 'entry-title' }, 'Entrada de la Pokédex'),
    genus,
    text,
  );

  let status = 'idle'; // 'idle' | 'loading' | 'done'
  const load = async () => {
    if (status !== 'idle') return;
    status = 'loading';
    panel.classList.add('is-loading');
    text.textContent = 'Consultando la Pokédex…';
    try {
      const entry = await loadEntry(pokemon);
      genus.textContent = entry?.genus ?? '';
      text.textContent = entry?.text ?? 'No hay entrada de la Pokédex para este Pokémon.';
      status = 'done';
    } catch (error) {
      text.textContent = `${error.message} Vuelve a pasar el ratón para reintentar.`;
      status = 'idle';
    } finally {
      panel.classList.remove('is-loading');
    }
  };

  return { panel, load };
}

const card = (pokemon, quartiles, loadEntry) => {
  const { panel, load } = entryPanel(pokemon, loadEntry);
  return h(
    'article',
    {
      class: `card type-${pokemon.types[0] ?? 'normal'}-card`,
      tabindex: '0', // permite enfocar con teclado o tocar en móvil
      'data-cry': pokemon.cry ?? '',
      onmouseenter: load,
      onfocus: load,
    },
    h('span', { class: 'number' }, pokemon.number),
    sprite(pokemon),
    h('h2', {}, pokemon.label),
    h('div', { class: 'badges' }, pokemon.types.map(typeBadge)),
    pokemon.stats.length
      ? h(
          'ul',
          { class: 'stats' },
          pokemon.stats.map((stat) => statRow(stat, quartiles[stat.name])),
        )
      : h('p', { class: 'muted' }, 'Sin estadísticas disponibles'),
    h(
      'p',
      { class: 'meta' },
      `${pokemon.meters.toFixed(1)} m · ${pokemon.kg.toFixed(1)} kg · Σ ${pokemon.total}`,
    ),
    panel,
  );
};

export const renderGrid = (container, list, quartiles = {}, loadEntry = async () => null) =>
  container.replaceChildren(...list.map((pokemon) => card(pokemon, quartiles, loadEntry)));

/**
 * Estados visibles: 'loading' | 'error' | 'empty' | 'warning' | 'info' | 'idle'
 * `onRetry` añade un botón de reintento al estado de error.
 */
export function renderStatus(container, { kind = 'idle', message = '', onRetry } = {}) {
  if (kind === 'idle') {
    container.replaceChildren();
    container.className = 'status';
    return;
  }
  container.className = `status status-${kind}`;
  container.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  container.replaceChildren(
    kind === 'loading' ? h('span', { class: 'pokeball', 'aria-hidden': 'true' }) : null,
    h('span', {}, message),
    kind === 'error' && onRetry ? h('button', { type: 'button', onclick: onRetry }, 'Reintentar') : null,
  );
}

export function renderSummary(container, summary, total) {
  if (summary.count === 0) {
    container.replaceChildren();
    return;
  }
  const item = (label, value) =>
    h('div', { class: 'summary-item' }, h('dt', {}, label), h('dd', {}, value));

  container.replaceChildren(
    h(
      'dl',
      {},
      item('Mostrando', `${summary.count} / ${total}`),
      item('Media de stats', String(summary.avgTotal)),
      item('Más fuerte', `${summary.strongest.label} (${summary.strongest.total})`),
      item('Tipo dominante', typeLabel(summary.topType)),
    ),
  );
}

export function renderTypeOptions(select, types) {
  const current = select.value;
  const options = types
    .map((type) => ({ type, label: typeLabel(type) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))
    .map(({ type, label }) => h('option', { value: type }, label));
  select.replaceChildren(h('option', { value: '' }, 'Todos'), ...options);
  select.value = current;
}