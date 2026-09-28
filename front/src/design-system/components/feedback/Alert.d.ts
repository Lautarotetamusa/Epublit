/** In-page message tied to the content around it. Tinted fill, hairline border, matching icon. */
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'info' | 'success' | 'warning' | 'error';
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Renders a close affordance when provided. */
  onClose?: () => void;
}
export function Alert(props: AlertProps): JSX.Element;
