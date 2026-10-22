/** Single metric tile for dashboards. Value in Spectral, label in uppercase micro-caps. */
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  /** Small trailing unit, e.g. "ejemplares". */
  unit?: string;
  /** Comparison line: a string, or a node when the comparison needs its own
   *  treatment (un Badge con flecha de suba/baja, por ejemplo). */
  delta?: React.ReactNode;
  deltaTone?: 'success' | 'error' | 'muted';
  icon?: string;
  /** `bare` drops the card frame (border, background, shadow) so the metric can
   *  live as a cell inside a container that is already a Card. */
  variant?: 'card' | 'bare';
}
export function StatCard(props: StatCardProps): JSX.Element;
