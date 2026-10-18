const PREFIX = 'async-odyssey:v4:'; // v4: incluye `species` , `entry` y `cry` en el caché
const TTL_MS = 1000 * 60 * 60 * 24; // 24 h

export function getCached(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { savedAt, data } = JSON.parse(raw);
    if (Date.now() - savedAt > TTL_MS) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function setCached(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Cuota llena o almacenamiento bloqueado: ignoramos.
  }
}

export function clearCache() {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Nada que limpiar.
  }
}