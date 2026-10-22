/**
 * Searchable dropdown for long lists (clientes, catálogo) where `Select`'s
 * native `<select>` becomes impractical to scroll through. Also the way to
 * show an option that exists but can't be picked (e.g. a book with 0 stock)
 * via `disabled` on that option, instead of hiding it.
 * @startingPoint section="Forms" subtitle="Searchable combobox" viewport="360x300"
 */
export interface ComboboxOption {
  value: string;
  label: string;
  /** Shown but not selectable (greyed out, click/Enter no-op). */
  disabled?: boolean;
}
export interface ComboboxProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: string;
  options: ComboboxOption[];
  placeholder?: string;
  /** Shown when the search doesn't match any option. */
  emptyMessage?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  size?: 'sm' | 'md';
}
export function Combobox(props: ComboboxProps): JSX.Element;
