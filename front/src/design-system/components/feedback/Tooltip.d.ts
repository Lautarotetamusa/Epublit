/** Hover-only micro label for truncated text and icon-only controls. Never holds essential copy. */
export interface TooltipProps extends React.HTMLAttributes<HTMLSpanElement> {
  label: React.ReactNode;
  placement?: 'top' | 'bottom';
  children?: React.ReactNode;
}
export function Tooltip(props: TooltipProps): JSX.Element;
