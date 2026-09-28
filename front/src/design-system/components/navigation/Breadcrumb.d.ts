/** Trail for nested records (Catálogo › Libros › La ciudad ausente). Chevron separators, last crumb bold. */
export interface BreadcrumbProps extends React.HTMLAttributes<HTMLElement> {
  items: Array<string | { label: string; value?: string }>;
  onNavigate?: (item: any, index: number) => void;
}
export function Breadcrumb(props: BreadcrumbProps): JSX.Element;
