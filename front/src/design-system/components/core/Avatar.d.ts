/** Initials-only circular avatar — Epublit never stores user photos. */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Full name; first two words become the initials. */
  name: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'brand' | 'accent' | 'neutral';
}
export function Avatar(props: AvatarProps): JSX.Element;
