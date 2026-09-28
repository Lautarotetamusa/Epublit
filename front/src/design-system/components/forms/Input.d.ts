/**
 * Single-line text control. Inset hairline, 5 px radius, violet focus ring.
 * @startingPoint section="Forms" subtitle="Inputs, selects, toggles" viewport="700x300"
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Icon stem shown inside the field, left of the caret. */
  iconStart?: string;
  /** Static trailing unit in mono type, e.g. "ARS" or "%". */
  suffix?: React.ReactNode;
  invalid?: boolean;
  size?: 'sm' | 'md' | 'lg';
}
export function Input(props: InputProps): JSX.Element;
