/**
 * Grupo de botones excluyentes para un set chico y fijo de opciones (2-4):
 * misma idea que `Select`, pero cuando conviene que las opciones se vean
 * de entrada en vez de estar ocultas atrás de un dropdown.
 * @startingPoint section="Forms" subtitle="Two/three-way exclusive toggle" viewport="360x60"
 */
export interface SegmentedControlProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Plain strings, or { value, label } pairs. */
  options: Array<string | { value: string; label: string }>;
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}
export function SegmentedControl(props: SegmentedControlProps): JSX.Element;
