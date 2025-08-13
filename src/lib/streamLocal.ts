// Local storage helpers for per-address stream start DAA tracking

const KEY = "vivoor.stream.startDaa"; // map of address -> number

type MapType = Record<string, number>;

function readMap(): MapType {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as MapType;
  } catch {
    return {};
  }
}

function writeMap(m: MapType) {
  localStorage.setItem(KEY, JSON.stringify(m));
}

export function getStartDaa(address: string): number | null {
  const m = readMap();
  const v = m[address];
  return typeof v === 'number' ? v : null;
}

export function setStartDaa(address: string, daa: number) {
  const m = readMap();
  m[address] = Math.max(0, Math.floor(daa));
  writeMap(m);
}

export function clearStartDaa(address: string) {
  const m = readMap();
  delete m[address];
  writeMap(m);
}
