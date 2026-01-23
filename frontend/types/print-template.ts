export interface PrintPosition {
  x: number;
  y: number;
}

export interface PrintField {
  x: number;
  y: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  align?: 'left' | 'center' | 'right';
  maxWidth?: number; // Para word wrap
  color?: string; // Hex color
}

export interface ItemsConfiguration {
  startY: number; // Y inicial de la primera fila
  spacing: number; // Espacio entre filas
  maxRows?: number; // Máximo de filas por página
  columns: {
    [key: string]: {
      x: number;
      align?: 'left' | 'center' | 'right';
      width?: number;
    };
  };
}

export interface PrintTemplate {
  name: string;
  version: string;
  type: 'invoice' | 'delivery-note';
  pageSize: {
    width: number; // En puntos (595 = A4 width)
    height: number; // En puntos (842 = A4 height)
  };
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  globalOffset?: {
    x: number;
    y: number;
  };
  font: {
    family: string;
    size: number;
  };
  fields: {
    [fieldName: string]: PrintField;
  };
  items?: ItemsConfiguration;
}
