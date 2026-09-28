/** Portada de libro: selector de imagen con marcador vertical (ver readme.md, Imágenes). */
export interface CoverUploadProps extends React.HTMLAttributes<HTMLDivElement> {
  /** URL a mostrar en el marcador (objectURL local o URL ya subida). */
  value?: string;
  onSelect: (file: File) => void;
  onRemove?: () => void;
  invalid?: boolean;
  disabled?: boolean;
}
export function CoverUpload(props: CoverUploadProps): JSX.Element;
