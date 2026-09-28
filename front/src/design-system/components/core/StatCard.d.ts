/** Single metric tile for dashboards. Value in Spectral, label in uppercase micro-caps. */
export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: React.ReactNode;
  /** Small trailing unit, e.g. "ejemplares". */
  unit?: string;
  /** Comparison line, e.g. "+12% vs. mes anterior". */
  delta?: string;
  deltaTone?: 'success' | 'error' | 'muted';
  icon?: string;
}
export function StatCard(props: StatCardProps): JSX.Element;
