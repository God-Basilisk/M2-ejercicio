// Capa de red: solo habla con PokeAPI. No conoce el DOM ni la lógica de negocio.
import { getCached, setCached } from './cache.js';

const BASE_URL = 'https://pokeapi.co/api/v2';
const TIMEOUT_MS = 10_000;

export const PAGE_SIZE = 24;

/**
 * fetch + async/await con comprobación de response.ok, timeout y caché.
 * `transform` reduce el JSON antes de cachearlo (el detalle de un Pokémon
 * pesa cientos de KB y localStorage tiene ~5 MB).
 */
async function fetchJson(url, transform = (data) => data) {
  const cached = getCached(url);
  if (cached) return cached;

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error('La API tardó demasiado en responder.');
    }
    throw new Error('No hay conexión con la API. Comprueba tu red.');
  }

  if (!response.ok) {
    throw new Error(`La API respondió con un error (${response.status}).`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('La API devolvió una respuesta que no es JSON válido.');
  }

  const slim = transform(data);
  setCached(url, slim);
  return slim;
}

// Nos quedamos solo con lo que usa la app y toleramos campos ausentes.
const slimPokemon = (raw) => ({
  id: raw?.id ?? 0,
  name: raw?.name ?? 'desconocido',
  height: raw?.height ?? 0,
  weight: raw?.weight ?? 0,
  species: raw?.species?.name ?? null,
  cry: raw?.cries?.latest ?? raw?.cries?.legacy ?? null,
  sprite:
    raw?.sprites?.other?.['official-artwork']?.front_default ??
    raw?.sprites?.front_default ??
    null,
  types: (raw?.types ?? []).map((t) => t.type.name),
  stats: (raw?.stats ?? []).map((s) => ({ name: s.stat.name, value: s.base_stat })),
});

export const getPokemon = (name) => fetchJson(`${BASE_URL}/pokemon/${name}`, slimPokemon);

// ---------- Entrada de la Pokédex (/pokemon-species) ----------
const LANGUAGES = ['es', 'en']; // preferimos español y, si no hay, inglés

// Primer elemento en el idioma preferido; devuelve el campo `key` o null.
const pickByLanguage = (items = [], key) =>
  LANGUAGES.map((lang) => items.find((item) => item.language?.name === lang))
    .find(Boolean)?.[key] ?? null;

// Los textos de la API traen saltos de línea, \f y guiones blandos.
const cleanText = (text) =>
  text.replace(/\u00ad\n?/g, '').replace(/[\n\f]/g, ' ').replace(/\s+/g, ' ').trim();

const slimSpecies = (raw) => {
  const text = pickByLanguage(raw?.flavor_text_entries, 'flavor_text');
  return {
    text: text ? cleanText(text) : null,
    genus: pickByLanguage(raw?.genera, 'genus'),
  };
};

/** { text, genus } de la especie, o null si el Pokémon no tiene especie asociada. */
export const getPokedexEntry = (speciesName) =>
  speciesName
    ? fetchJson(`${BASE_URL}/pokemon-species/${speciesName}`, slimSpecies)
    : Promise.resolve(null);

/** Lista de tipos disponibles (sin los especiales 'unknown', 'shadow'…). */
export async function getTypes() {
  const data = await fetchJson(`${BASE_URL}/type`, (raw) => ({
    results: (raw?.results ?? []).map(({ name }) => ({ name })),
  }));
  return data.results.map((t) => t.name);
}

/**
 * Pide una página de la lista y luego el detalle de cada Pokémon en paralelo.
 * Con allSettled, un fallo individual no tumba la página entera.
 */
export async function getPokemonPage(offset, limit = PAGE_SIZE) {
  // PokeAPI devuelve `count` (total de Pokémon) en cada página de la lista,
  // así que no hace falta fijar un máximo a mano: la API nos dice cuántos hay.
  const list = await fetchJson(
    `${BASE_URL}/pokemon?offset=${offset}&limit=${limit}`,
    (raw) => ({
      count: raw?.count ?? 0,
      results: (raw?.results ?? []).map(({ name }) => ({ name })),
    }),
  );

  if (list.results.length === 0) return { items: [], failed: 0, total: list.count };

  const settled = await Promise.allSettled(list.results.map(({ name }) => getPokemon(name)));

  const items = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const failed = settled.length - items.length;

  // Si TODO falló, es un error real de red y lo propagamos al usuario.
  if (items.length === 0 && failed > 0) {
    const firstError = settled.find((r) => r.status === 'rejected');
    throw firstError.reason;
  }

  return { items, failed, total: list.count };
}