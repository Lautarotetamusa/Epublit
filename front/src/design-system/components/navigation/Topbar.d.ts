/** Screen header: breadcrumb + title on the left, search and actions on the right. 60 px, white, hairline bottom. */
export interface TopbarProps extends React.HTMLAttributes<HTMLElement> {
  title?: React.ReactNode;
  /** Uppercase parent path, e.g. "Catálogo". */
  breadcrumb?: React.ReactNode;
  /** true for a default field, or a string used as the placeholder. */
  search?: boolean | string;
  onSearch?: (value: string) => void;
  /** Buttons shown left of the bell. */
  actions?: React.ReactNode;
  /** Usually an Avatar. */
  user?: React.ReactNode;
}
export function Topbar(props: TopbarProps): JSX.Element;
