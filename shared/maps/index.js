// Lista de mapas disponíveis, escolhidos pelo id (ex.: ?mapa=sandbox).
import { sandbox } from './sandbox.js';

export const MAPS = Object.freeze({ [sandbox.id]: sandbox });
export const DEFAULT_MAP_ID = sandbox.id;

/** Mapa pelo id; id vazio ou desconhecido devolve o padrão. */
export function getMap(id) {
  return MAPS[id] ?? MAPS[DEFAULT_MAP_ID];
}
