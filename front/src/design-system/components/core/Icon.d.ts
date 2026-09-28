/** Lucide glyph tinted with currentColor. 20 px default UI size; 1.5 px stroke set. */
export interface IconProps {
  /** File stem in assets/icons, e.g. "book-open". */
  name: string;
  /** Pixel box. 16 dense tables, 18 controls, 20 nav, 24 empty states. */
  size?: number;
  /** Any CSS color; defaults to currentColor. */
  color?: string;
  style?: React.CSSProperties;
}
export function Icon(props: IconProps): JSX.Element;
