/** Label + control + hint/error wrapper. Every form control in Epublit sits inside a Field. */
export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  /** Helper text below the control; hidden while `error` is set. */
  hint?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  htmlFor?: string;
  children?: React.ReactNode;
}
export function Field(props: FieldProps): JSX.Element;
