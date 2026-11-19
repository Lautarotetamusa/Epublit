/**
 * Single-line text control. Inset hairline, 5 px radius, violet focus ring.
 * @startingPoint section="Forms" subtitle="Inputs, selects, toggles" viewport="700x300"
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Icon stem shown inside the field, left of the caret. */
  iconStart?: string;
  /** Static trailing unit in mono type, e.g. "ARS" or "%". */
  suffix?: React.ReactNode;
  /** Interactive control at the end of the field (e.g. an IconButton that reveals a password). */
  trailing?: React.ReactNode;
  /** Render the value in JetBrains Mono — API keys, tracking codes, ISBN. */
  mono?: boolean;
  invalid?: boolean;
  /** Lands on the inner <input> (React 19 passes ref as a prop), e.g. to focus the first invalid field. */
  ref?: React.Ref<HTMLInputElement>;
  size?: 'sm' | 'md' | 'lg';
}
export function Input(props: InputProps): JSX.Element;
