/** Record count + prev/next controls. Lives in a Card footer, never floating. */
export interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  page?: number;
  pageCount?: number;
  /** Total record count shown before the page counter. */
  total?: number;
  /** Noun used after the total, e.g. "cuentas". Defaults to "registros". */
  itemLabel?: string;
  onChange?: (page: number) => void;
}
export function Pagination(props: PaginationProps): JSX.Element;
