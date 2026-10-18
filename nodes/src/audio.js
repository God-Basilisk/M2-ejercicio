// Audio: reproduce el grito de un Pokémon. Solo suena uno a la vez.
let current = null;

/** Reproduce la URL indicada. Devuelve true si empezó a sonar, false si no pudo. */
export async function playCry(url) {
  if (!url) return false;

  current?.pause(); // si hay otro grito sonando, lo cortamos
  current = new Audio(url);
  current.volume = 0.5;

  try {
    await current.play();
    return true;
  } catch {
    // El navegador bloqueó el audio, la URL falló o el formato (.ogg) no es compatible.
    return false;
  }
}