/** Imagen de contenido horizontal: portada de página, bloque de imagen, ítem de galería. */
export interface MediaUploadProps extends React.HTMLAttributes<HTMLDivElement> {
  /** URL a mostrar en el marcador (objectURL local o URL ya subida). */
  value?: string;
  onSelect: (file: File) => void;
  onRemove?: () => void;
  /** Se llama en vez de `onSelect` cuando el archivo no cumple `maxSizeMb`/`minWidthPx`/`minHeightPx`, con un mensaje ya redactado para mostrar. */
  onRejected?: (message: string) => void;
  /** Tamaño máximo en MB. Sin esta prop, no se rechaza ningún archivo por peso. */
  maxSizeMb?: number;
  /** Ancho mínimo en píxeles. Sin esta prop, no se valida resolución horizontal. */
  minWidthPx?: number;
  /** Alto mínimo en píxeles. Sin esta prop, no se valida resolución vertical. */
  minHeightPx?: number;
  /** Marcador reducido para galerías y filas compactas. */
  compact?: boolean;
  /** Sustantivo de la acción: "imagen" → "Subir imagen", "portada" → "Subir portada". */
  label?: string;
  hint?: React.ReactNode;
  invalid?: boolean;
  disabled?: boolean;
}
export function MediaUpload(props: MediaUploadProps): JSX.Element;
