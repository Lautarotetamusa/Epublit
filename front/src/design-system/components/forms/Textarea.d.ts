/** Multi-line text control — synopsis, notes, contract clauses. */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  rows?: number;
  ref?: React.Ref<HTMLTextAreaElement>;
}
export function Textarea(props: TextareaProps): JSX.Element;
