/** One-of-many option. Supports a second description line for consignment vs firm-sale style choices. */
export interface RadioProps extends React.HTMLAttributes<HTMLLabelElement> {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked?: boolean;
  disabled?: boolean;
  name?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}
export function Radio(props: RadioProps): JSX.Element;
