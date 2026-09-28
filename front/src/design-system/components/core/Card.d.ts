/**
 * The default container: white paper, hairline border, 8 px radius, short soft shadow.
 * @startingPoint section="Core" subtitle="Card, stat card and badges" viewport="700x260"
 */
export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-aligned header controls (usually Buttons or IconButtons). */
  actions?: React.ReactNode;
  /** Sunken footer strip for counts, totals or secondary links. */
  footer?: React.ReactNode;
  /** Set false when the body is a full-bleed Table. */
  padded?: boolean;
  children?: React.ReactNode;
}
export function Card(props: CardProps): JSX.Element;
