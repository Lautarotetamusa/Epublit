/** Square, label-less action for toolbars and table rows. Always pass `label` for a11y + tooltip. */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon stem from assets/icons. */
  icon: string;
  /** Accessible name, also used as the native title tooltip. */
  label: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'outline' | 'solid';
  active?: boolean;
}
export function IconButton(props: IconButtonProps): JSX.Element;
