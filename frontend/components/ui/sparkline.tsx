import React from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  showDots?: boolean;
  className?: string;
}

/**
 * Sparkline - Mini gráfico de línea para mostrar tendencias
 * Útil para mostrar tendencias de ventas en tablas
 */
export function Sparkline({
  data,
  width = 100,
  height = 30,
  color = 'rgb(59, 130, 246)', // blue-500
  fillColor = 'rgba(59, 130, 246, 0.1)',
  showDots = false,
  className = '',
}: SparklineProps) {
  // Si no hay datos o todos son 0, mostrar línea plana
  if (!data || data.length === 0 || data.every(v => v === 0)) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`} 
        style={{ width, height }}
      >
        <span className="text-xs text-muted-foreground">Sin datos</span>
      </div>
    );
  }

  const max = Math.max(...data, 1); // Evitar división por 0
  const min = Math.min(...data, 0);
  const range = max - min || 1; // Evitar división por 0

  // Calcular puntos para el path
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return { x, y };
  });

  // Crear path para la línea
  const linePath = points
    .map((point, index) => {
      if (index === 0) {
        return `M ${point.x} ${point.y}`;
      }
      return `L ${point.x} ${point.y}`;
    })
    .join(' ');

  // Crear path para el área de relleno
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      className={className}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      {/* Área de relleno */}
      <path
        d={areaPath}
        fill={fillColor}
        stroke="none"
      />
      
      {/* Línea */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Puntos opcionales */}
      {showDots && points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r="2"
          fill={color}
        />
      ))}
    </svg>
  );
}

interface SparklineWithTooltipProps extends SparklineProps {
  labels?: string[]; // Etiquetas para cada punto (ej: nombres de meses)
  formatValue?: (value: number) => string;
}

/**
 * SparklineWithTooltip - Sparkline con tooltip al hacer hover
 */
export function SparklineWithTooltip({
  data,
  labels,
  formatValue = (v) => v.toString(),
  ...sparklineProps
}: SparklineWithTooltipProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 });

  if (!data || data.length === 0) {
    return <Sparkline data={data} {...sparklineProps} />;
  }

  const width = sparklineProps.width || 100;
  const height = sparklineProps.height || 30;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const index = Math.round((x / width) * (data.length - 1));
    
    if (index >= 0 && index < data.length) {
      setHoveredIndex(index);
      setTooltipPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair"
      >
        <Sparkline data={data} {...sparklineProps} />
      </div>

      {hoveredIndex !== null && (
        <div
          className="fixed z-50 bg-popover text-popover-foreground rounded-md shadow-md px-3 py-2 text-sm pointer-events-none"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 10,
          }}
        >
          <div className="font-medium">
            {labels && labels[hoveredIndex] ? labels[hoveredIndex] : `Punto ${hoveredIndex + 1}`}
          </div>
          <div className="text-muted-foreground">
            {formatValue(data[hoveredIndex])}
          </div>
        </div>
      )}
    </div>
  );
}


