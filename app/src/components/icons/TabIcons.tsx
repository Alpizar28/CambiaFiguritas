import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

type IconProps = {
  size?: number;
  active?: boolean;
};

const PALETTE = {
  yellow: '#FFD600',
  red: '#D9272D',
  green: '#00B86B',
  blue: '#1E66D6',
  cream: '#FAF6E8',
  ink: '#1A1A1A',
  mute: '#7A7A7A',
};

/**
 * Album → figurita estilo papel con número
 */
export function AlbumIcon({ size = 28, active = false }: IconProps) {
  const stroke = active ? PALETTE.red : PALETTE.mute;
  const fill = active ? PALETTE.cream : '#2A2A2A';
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      {/* Carta atrás */}
      <Rect
        x={5}
        y={6}
        width={16}
        height={20}
        rx={2}
        fill={active ? PALETTE.yellow : '#3A3A3A'}
        stroke={stroke}
        strokeWidth={1.5}
        transform="rotate(-6 13 16)"
      />
      {/* Carta principal */}
      <Rect
        x={7}
        y={4}
        width={16}
        height={20}
        rx={2}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.8}
      />
      {/* Header de la carta */}
      <Rect
        x={7}
        y={4}
        width={16}
        height={5}
        rx={2}
        fill={active ? PALETTE.green : PALETTE.mute}
      />
      {/* Número */}
      <Path
        d="M11 14 L11 20 M11 14 L14 14 L14 17 L11 17"
        stroke={active ? PALETTE.ink : PALETTE.mute}
        strokeWidth={1.6}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 14 L16 20"
        stroke={active ? PALETTE.ink : PALETTE.mute}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/**
 * Matches → dos manos chocando (intercambio)
 */
export function MatchesIcon({ size = 28, active = false }: IconProps) {
  const c1 = active ? PALETTE.yellow : PALETTE.mute;
  const c2 = active ? PALETTE.blue : '#5A5A5A';
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      {/* Mano izquierda */}
      <Path
        d="M3 14 L9 9 L13 11 L15 13 L13 15 L9 16 L3 16 Z"
        fill={c1}
        stroke={active ? PALETTE.red : PALETTE.mute}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* Mano derecha */}
      <Path
        d="M25 14 L19 9 L15 11 L13 13 L15 15 L19 16 L25 16 Z"
        fill={c2}
        stroke={active ? PALETTE.ink : PALETTE.mute}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* Chispas de match */}
      {active && (
        <G>
          <Circle cx={14} cy={6} r={1.2} fill={PALETTE.yellow} />
          <Circle cx={10} cy={22} r={1} fill={PALETTE.green} />
          <Circle cx={18} cy={22} r={1} fill={PALETTE.red} />
        </G>
      )}
    </Svg>
  );
}

/**
 * Events → pin de mapa con sombra
 */
export function EventsIcon({ size = 28, active = false }: IconProps) {
  const fill = active ? PALETTE.red : PALETTE.mute;
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      {/* Sombra debajo */}
      <Path
        d="M10 24 Q14 26 18 24"
        stroke={active ? '#A81E22' : '#3A3A3A'}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
      {/* Pin */}
      <Path
        d="M14 3 C9 3 5.5 6.5 5.5 11 C5.5 16 14 24 14 24 C14 24 22.5 16 22.5 11 C22.5 6.5 19 3 14 3 Z"
        fill={fill}
        stroke={active ? '#A81E22' : PALETTE.mute}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {/* Punto blanco interior */}
      <Circle cx={14} cy={11} r={3.5} fill={active ? PALETTE.cream : '#0A0A0A'} />
      {active && <Circle cx={14} cy={11} r={1.6} fill={PALETTE.yellow} />}
    </Svg>
  );
}

/**
 * Rankings → trofeo con halo dorado
 */
export function RankingsIcon({ size = 28, active = false }: IconProps) {
  const main = active ? PALETTE.yellow : PALETTE.mute;
  const fill = active ? PALETTE.yellow : '#3A3A3A';
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      {/* Asa izquierda */}
      <Path
        d="M7 8 C5 8 4 9 4 11 C4 13 5 14 7 14"
        stroke={main}
        strokeWidth={1.6}
        fill="none"
      />
      {/* Asa derecha */}
      <Path
        d="M21 8 C23 8 24 9 24 11 C24 13 23 14 21 14"
        stroke={main}
        strokeWidth={1.6}
        fill="none"
      />
      {/* Copa */}
      <Path
        d="M7 5 H21 V13 C21 17 18 19.5 14 19.5 C10 19.5 7 17 7 13 Z"
        fill={fill}
        stroke={main}
        strokeWidth={1.6}
      />
      {/* Pie */}
      <Rect x={11} y={19} width={6} height={2.5} fill={main} />
      <Rect x={9} y={21.5} width={10} height={2} rx={1} fill={main} />
      {/* Estrella central si activo */}
      {active ? (
        <Path
          d="M14 8 L15 11 L18 11 L15.5 13 L16.5 16 L14 14 L11.5 16 L12.5 13 L10 11 L13 11 Z"
          fill="#0A0A0A"
        />
      ) : null}
    </Svg>
  );
}

/**
 * Profile → silueta con halo deportivo
 */
export function ProfileIcon({ size = 28, active = false }: IconProps) {
  const main = active ? PALETTE.green : PALETTE.mute;
  const accent = active ? PALETTE.yellow : '#3A3A3A';
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      {/* Halo de fondo */}
      <Circle cx={14} cy={14} r={12} fill={accent} opacity={active ? 0.9 : 0.5} />
      {/* Cabeza */}
      <Circle
        cx={14}
        cy={11}
        r={4.2}
        fill={active ? PALETTE.cream : '#1A1A1A'}
        stroke={main}
        strokeWidth={1.6}
      />
      {/* Cuerpo */}
      <Path
        d="M5.5 24 C5.5 19 9 17 14 17 C19 17 22.5 19 22.5 24 Z"
        fill={active ? PALETTE.cream : '#1A1A1A'}
        stroke={main}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      {/* Acento camiseta */}
      {active && (
        <Path
          d="M11 19 L14 21 L17 19"
          stroke={PALETTE.red}
          strokeWidth={1.4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </Svg>
  );
}
