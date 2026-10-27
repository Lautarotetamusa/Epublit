/**
 * Vertical history of a record: what already happened, in order, with the
 * latest milestone marked as current. It never invents future steps.
 */
export interface TimelineItem {
  id?: string | number;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Formatted date/time, e.g. "20/10/2026, 10:35". */
  timestamp?: React.ReactNode;
  tone?: 'done' | 'current' | 'pending' | 'error';
}

export interface TimelineProps extends React.HTMLAttributes<HTMLOListElement> {
  items: TimelineItem[];
}

export function Timeline(props: TimelineProps): JSX.Element;
