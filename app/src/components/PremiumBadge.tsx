import { CrownIcon } from './icons/CrownIcon';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
};

const SIZES: Record<NonNullable<Props['size']>, number> = {
  sm: 14,
  md: 18,
  lg: 24,
};

export function PremiumBadge({ size = 'md', color }: Props) {
  return <CrownIcon size={SIZES[size]} color={color} />;
}
