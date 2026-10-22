/** Centred modal for a single focused task (nuevo libro, confirmar liquidación). Fixed to the viewport, so it stays centred regardless of the page's scroll position or the height of its parent. */
export interface DialogProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned action row; primary Button last. */
  footer?: React.ReactNode;
  width?: number;
  onClose?: () => void;
  children?: React.ReactNode;
}
export function Dialog(props: DialogProps): JSX.Element;
