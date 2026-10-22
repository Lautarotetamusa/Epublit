/** Compact status label for rows and headers. Soft tinted fill, hairline border, 3 px radius. */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'brand' | 'accent' | 'success' | 'warning' | 'error';
  /** Icon stem from assets/icons. */
  icon?: string;
  /** Show a small filled dot instead of an icon (stock / liquidación states). */
  dot?: boolean;
  children?: React.ReactNode;
}
export function Badge(props: BadgeProps): JSX.Element;
