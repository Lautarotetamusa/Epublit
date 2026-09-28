/** Instant-effect toggle (no save button). For form values that need saving, use Checkbox. */
export interface SwitchProps extends React.HTMLAttributes<HTMLLabelElement> {
  label?: React.ReactNode;
  checked?: boolean;
  disabled?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}
export function Switch(props: SwitchProps): JSX.Element;
