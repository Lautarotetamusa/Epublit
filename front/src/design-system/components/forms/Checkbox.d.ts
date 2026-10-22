/** Square 17 px checkbox, green when set. Also used as the table row selector. */
export interface CheckboxProps extends React.HTMLAttributes<HTMLLabelElement> {
  label?: React.ReactNode;
  checked?: boolean;
  /** Header state when some rows are selected. */
  indeterminate?: boolean;
  disabled?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}
export function Checkbox(props: CheckboxProps): JSX.Element;
