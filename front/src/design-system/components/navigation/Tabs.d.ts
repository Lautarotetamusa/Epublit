/** Underlined section switcher inside a screen (Ficha / Stock / Movimientos). Never for primary nav. */
export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  items: Array<string | { value: string; label: string; count?: number }>;
  value?: string;
  onChange?: (value: string) => void;
}
export function Tabs(props: TabsProps): JSX.Element;
