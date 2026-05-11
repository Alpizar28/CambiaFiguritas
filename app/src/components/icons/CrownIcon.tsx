import Svg, { Path, Circle } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

export function CrownIcon({ size = 16, color = '#FFD700' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z"
        fill={color}
        stroke={color}
        strokeWidth={1.2}
        strokeLinejoin="round"
      />
      <Circle cx="3" cy="8" r="1.4" fill={color} />
      <Circle cx="21" cy="8" r="1.4" fill={color} />
      <Circle cx="12" cy="5" r="1.4" fill={color} />
    </Svg>
  );
}
