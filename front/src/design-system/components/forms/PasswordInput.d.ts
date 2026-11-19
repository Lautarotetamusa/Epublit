import type { InputProps } from './Input';

/** Password field with a show/hide toggle at the end. Same chrome and states as Input. */
export interface PasswordInputProps extends Omit<InputProps, 'type' | 'trailing'> {}
export function PasswordInput(props: PasswordInputProps): JSX.Element;
