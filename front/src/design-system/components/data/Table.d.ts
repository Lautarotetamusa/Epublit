/**
 * The workhorse of Epublit: catálogo, stock, liquidaciones, movimientos.
 * Uppercase micro-caps header on paper-50, hairline row rules, no zebra striping.
 * @startingPoint section="Data" subtitle="Data table with header, rows and states" viewport="700x300"
 */
export interface TableColumn<R = any> {
  /** Column heading. */
  header: React.ReactNode;
  /** Row property to read when `cell` is not given. */
  key?: string;
  /** Custom renderer — use for Badges, buttons or composed cells. */
  cell?: (row: R, index: number) => React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: number | string;
  /** Render in JetBrains Mono — ISBN, codes, quantities. */
  mono?: boolean;
  muted?: boolean;
  /** Allow the cell to wrap (default: nowrap). */
  wrap?: boolean;
}
export interface TableProps<R = any> extends React.HTMLAttributes<HTMLDivElement> {
  columns: TableColumn<R>[];
  rows: R[];
  dense?: boolean;
  /** Adds a checkbox column (row + header "select all"). Requires `selectedKeys`/`onSelectionChange`. */
  selectable?: boolean;
  /** Row keys currently checked, as returned by `rowKey`. */
  selectedKeys?: Set<string | number>;
  onSelectionChange?: (keys: Set<string | number>) => void;
  /** Identity used for selection; defaults to `row.id ?? row.isbn ?? index`. */
  rowKey?: (row: R, index: number) => string | number;
  onRowClick?: (row: R, index: number) => void;
  /** Message shown when `rows` is empty. */
  empty?: React.ReactNode;
}
export function Table(props: TableProps): JSX.Element;
