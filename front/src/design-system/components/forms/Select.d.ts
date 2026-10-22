/** Native dropdown restyled to match Input. Use for closed sets under ~15 options. */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Plain strings, or { value, label } pairs. */
  options?: Array<string | { value: string; label: string }>;
  /** Empty-value first option. */
  placeholder?: string;
  invalid?: boolean;
  size?: 'sm' | 'md';
}
export function Select(props: SelectProps): JSX.Element;
