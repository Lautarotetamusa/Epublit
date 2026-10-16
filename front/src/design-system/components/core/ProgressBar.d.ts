/**
 * Barra de progreso lineal para un valor de 0 a 100 (cuánto se pagó de una
 * liquidación, stock comprometido). Lleva la cifra en mono al lado: la barra
 * acompaña al número, no lo reemplaza.
 */
export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Porcentaje 0–100. Se redondea y se recorta al rango. */
  value?: number;
  tone?: 'brand' | 'success' | 'accent' | 'warning';
  /** Etiqueta en micro-caps arriba de la barra. */
  label?: React.ReactNode;
  /** Muestra el porcentaje en mono a la derecha (default true). */
  showValue?: boolean;
  size?: 'sm' | 'md';
}
export function ProgressBar(props: ProgressBarProps): JSX.Element;
