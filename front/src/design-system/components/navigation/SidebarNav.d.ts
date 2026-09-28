/**
 * Fixed dark-green primary navigation, 248 px, always visible on desktop. The white
 * lockup sits in the header block; sections are uppercase micro-caps dividers.
 * @startingPoint section="Navigation" subtitle="App sidebar and top bar" viewport="700x360"
 */
export interface SidebarNavItem {
  /** Renders as an uppercase group divider instead of a link. */
  section?: string;
  value?: string;
  label?: string;
  /** Icon stem from assets/icons. */
  icon?: string;
  /** Small mono counter on the right. */
  badge?: string | number;
}
export interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: SidebarNavItem[];
  value?: string;
  onChange?: (value: string) => void;
  /** Path to the white lockup PNG, relative to the consuming file. */
  logoSrc?: string;
  /** Bottom block — usually the user row. */
  footer?: React.ReactNode;
}
export function SidebarNav(props: SidebarNavProps): JSX.Element;
