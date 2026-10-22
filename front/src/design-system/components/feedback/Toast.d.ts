/** Transient confirmation, bottom-left, dark green surface. One at a time; ~4 s. */
export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'success' | 'warning' | 'error';
  message: React.ReactNode;
  /** Single inline undo/see-it link. */
  action?: React.ReactNode;
  onClose?: () => void;
}
export function Toast(props: ToastProps): JSX.Element;
