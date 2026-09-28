/**
 * Cantidad con botones -/+ para el caso común de ajustar de a uno (líneas de
 * venta/consignación, stock): evita tener que tipear para el ajuste típico,
 * sin perder la posibilidad de escribir un número puntual.
 * @startingPoint section="Forms" subtitle="Quantity stepper with -/+ controls" viewport="320x80"
 */
export interface QuantityStepperProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}
export function QuantityStepper(props: QuantityStepperProps): JSX.Element;
