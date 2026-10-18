// Lógica pura: transforma, filtra, ordena y resume datos. Sin DOM ni red.

export const TYPE_LABELS = {
  normal: 'Normal',
  fire: 'Fuego',
  water: 'Agua',
  electric: 'Eléctrico',
  grass: 'Planta',
  ice: 'Hielo',
  fighting: 'Lucha',
  poison: 'Veneno',
  ground: 'Tierra',
  flying: 'Volador',
  psychic: 'Psíquico',
  bug: 'Bicho',
  rock: 'Roca',
  ghost: 'Fantasma',
  dragon: 'Dragón',
  dark: 'Siniestro',
  steel: 'Acero',
  fairy: 'Hada',
};

export const STAT_LABELS = {
  hp: 'PS',
  attack: 'ATQ',
  defense: 'DEF',
  'special-attack': 'ATQ.E',
  'special-defense': 'DEF.E',
  speed: 'VEL',
};

export const MAX_STAT = 200; // referencia para pintar las barras

export const typeLabel = (type) => TYPE_LABELS[type] ?? type;

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Convierte el dato "slim" de la API en un modelo listo para pintar. */
export const toViewModel = (pokemon) => ({
  ...pokemon,
  label: capitalize(pokemon.name.replace(/-/g, ' ')),
  number: `#${String(pokemon.id).padStart(3, '0')}`,
  kg: pokemon.weight / 10,
  meters: pokemon.height / 10,
  total: pokemon.stats.reduce((sum, stat) => sum + stat.value, 0),
});

/** Une páginas nuevas con las ya cargadas sin duplicar ids. */
export const mergeById = (current, incoming) =>
  [...new Map([...current, ...incoming].map((p) => [p.id, p])).values()];

export const filterPokemon = (list, { query = '', type = '' } = {}) => {
  const needle = query.trim().toLowerCase();
  return list
    .filter((p) => !needle || p.name.includes(needle) || String(p.id) === needle)
    .filter((p) => !type || p.types.includes(type));
};

const COMPARATORS = {
  id: (a, b) => a.id - b.id,
  name: (a, b) => a.name.localeCompare(b.name, 'es'),
  total: (a, b) => b.total - a.total,
  weight: (a, b) => b.weight - a.weight,
};

export const sortPokemon = (list, key = 'id') => [...list].sort(COMPARATORS[key] ?? COMPARATORS.id);

/** Resumen del listado visible calculado con reduce. */
export const summarize = (list) => {
  if (list.length === 0) return { count: 0, avgTotal: 0, strongest: null, topType: null };

  const { sum, strongest, typeCount } = list.reduce(
    (acc, p) => ({
      sum: acc.sum + p.total,
      strongest: !acc.strongest || p.total > acc.strongest.total ? p : acc.strongest,
      typeCount: p.types.reduce(
        (counts, t) => ({ ...counts, [t]: (counts[t] ?? 0) + 1 }),
        acc.typeCount,
      ),
    }),
    { sum: 0, strongest: null, typeCount: {} },
  );

  const [topType] = Object.entries(typeCount).sort(([, a], [, b]) => b - a)[0] ?? [null];

  return { count: list.length, avgTotal: Math.round(sum / list.length), strongest, topType };
};

/** Cuantil con interpolación lineal sobre un array YA ordenado. */
const quantile = (sorted, q) => {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] === undefined
    ? sorted[base]
    : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
};

/** Q1 y Q3 de cada stat: { hp: { q1, q3 }, attack: { q1, q3 }, … } */
export const computeQuartiles = (list) => {
  const byStat = list
    .flatMap((p) => p.stats)
    .reduce((groups, { name, value }) => {
      (groups[name] ??= []).push(value);
      return groups;
    }, {});

  return Object.fromEntries(
    Object.entries(byStat).map(([name, values]) => {
      const sorted = values.sort((a, b) => a - b);
      return [name, { q1: quantile(sorted, 0.25), q3: quantile(sorted, 0.75) }];
    }),
  );
};

/** < Q1 → 'low' (rojo) · entre Q1 y Q3 → 'mid' (amarillo) · > Q3 → 'high' (verde) */
export const statLevel = (value, range) => {
  if (!range) return 'mid';
  if (value < range.q1) return 'low';
  if (value > range.q3) return 'high';
  return 'mid';
};

export const LEVEL_LABELS = {
  low: 'Bajo (por debajo de Q1)',
  mid: 'Medio (entre Q1 y Q3)',
  high: 'Alto (por encima de Q3)',
};