// Constantes visuais da câmera e do HUD (F1-18). Só imagem: não mudam a física.
// Os números de balanceamento do jogo continuam em shared/constants.js.
import { VIEW } from '../../shared/constants.js';

const DEG = Math.PI / 180;

export const CAMERA = Object.freeze({
  /** Campo de visão vertical parado (graus). Ajustável por ?fov= no endereço. */
  FOV_BASE: VIEW.FOV,
  /** Campo de visão na velocidade alta (graus), com o FOV base padrão. Com ?fov=, soma o mesmo tanto. */
  FOV_MAX: 112,
  /** Velocidade horizontal em que o campo de visão chega ao máximo (m/s). */
  FOV_MAX_AT_SPEED: 30,
  /** Rapidez com que o campo de visão acompanha a velocidade (1/s). */
  FOV_SMOOTH_RATE: 6,
  /** Menor e maior FOV base aceitos por ?fov= (graus). */
  FOV_MIN_ALLOWED: 60,
  FOV_MAX_ALLOWED: 120,
  /** Inclinação da câmera ao andar de lado no chão (rad): ±1,5 graus. */
  STRAFE_TILT: 1.5 * DEG,
  /** Afundamento da câmera ao pousar: só de quedas acima desta altura (m). */
  LAND_DIP_MIN_HEIGHT: 3,
  /** Afundamento máximo (m), em quedas de LAND_DIP_FULL_HEIGHT ou mais. */
  LAND_DIP_DEPTH: 0.18,
  LAND_DIP_FULL_HEIGHT: 10,
  /** Duração do afundamento (s). */
  LAND_DIP_TIME: 0.3,
});

export const HUD = Object.freeze({
  /** Velocímetro: acima destas velocidades (m/s) a cor muda. */
  SPEED_TIER_1: 15,
  SPEED_TIER_2: 25,
  /** Cores do velocímetro: normal, acima de 15, acima de 25. */
  SPEED_COLORS: Object.freeze(['#f0f0f0', '#00e5ff', '#ff3df0']),
});
