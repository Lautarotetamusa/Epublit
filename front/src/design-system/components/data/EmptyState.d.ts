/** Shown when a list has no records yet. Always offers the action that fills it. */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon stem; default "book-open". */
  icon?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Usually a primary Button. */
  action?: React.ReactNode;
}
export function EmptyState(props: EmptyStateProps): JSX.Element;
