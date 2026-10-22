/**
 * Primary action control. 5 px radius, semibold Manrope, solid green for the single
 * main action per view; secondary (white + hairline) for everything beside it.
 * @startingPoint section="Core" subtitle="Buttons, icon buttons and states" viewport="700x180"
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = green, accent = violet (used sparingly for ecommerce/upsell), secondary, ghost, danger. */
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  /** Icon stem from assets/icons rendered before the label. */
  iconStart?: string;
  iconEnd?: string;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}
export function Button(props: ButtonProps): JSX.Element;
