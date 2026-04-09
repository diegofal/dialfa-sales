import React from 'react';
import { createPortal } from 'react-dom';
import type { ArticleMovement } from '@/types/stockSnapshot';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  showDots?: boolean;
  autoScale?: boolean;
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
  autoScale = false,
  className = '',
}: SparklineProps) {
  // Si no hay datos o todos son 0, mostrar línea plana
  if (!data || data.length === 0 || data.every((v) => v === 0)) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width, height }}>
        <span className="text-muted-foreground text-xs">Sin datos</span>
      </div>
    );
  }

  const max = Math.max(...data, 1); // Evitar división por 0
  const min = autoScale ? Math.min(...data) : Math.min(...data, 0);
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
      <path d={areaPath} fill={fillColor} stroke="none" />

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
      {showDots &&
        points.map((point, index) => (
          <circle key={index} cx={point.x} cy={point.y} r="2" fill={color} />
        ))}
    </svg>
  );
}

interface SparklineWithTooltipProps extends SparklineProps {
  labels?: string[]; // Etiquetas para cada punto (ej: nombres de meses)
  formatValue?: (value: number) => string;
  movements?: ArticleMovement[];
}

/**
 * SparklineWithTooltip - Sparkline con tooltip al hacer hover
 */
export function SparklineWithTooltip({
  data,
  labels,
  formatValue = (v) => v.toString(),
  movements,
  ...sparklineProps
}: SparklineWithTooltipProps) {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);

  if (!data || data.length === 0) {
    return <Sparkline data={data} {...sparklineProps} />;
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const index = Math.round((x / rect.width) * (data.length - 1));

    if (index >= 0 && index < data.length) {
      setHoveredIndex(index);
      setTooltipPosition({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair"
      >
        <Sparkline data={data} {...sparklineProps} />
      </div>

      {hoveredIndex !== null &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="bg-popover text-popover-foreground pointer-events-none fixed z-50 max-w-xs rounded-md px-3 py-2 text-sm shadow-md"
            style={{
              left: tooltipPosition.x + 10,
              top: tooltipPosition.y - 10,
            }}
          >
            <div className="font-medium">
              {labels && labels[hoveredIndex] ? labels[hoveredIndex] : `Punto ${hoveredIndex + 1}`}
            </div>
            <div className="text-muted-foreground">{formatValue(data[hoveredIndex])}</div>
            {movements && movements[hoveredIndex] && (
              <>
                {movements[hoveredIndex].entered.length > 0 && (
                  <div className="mt-1 text-xs text-green-600 dark:text-green-400">
                    <span className="font-medium">
                      + Entraron ({movements[hoveredIndex].entered.length}):
                    </span>{' '}
                    {movements[hoveredIndex].entered.slice(0, 5).join(', ')}
                    {movements[hoveredIndex].entered.length > 5 &&
                      ` y ${movements[hoveredIndex].entered.length - 5} más`}
                  </div>
                )}
                {movements[hoveredIndex].exited.length > 0 && (
                  <div className="mt-1 text-xs text-red-600 dark:text-red-400">
                    <span className="font-medium">
                      − Salieron ({movements[hoveredIndex].exited.length}):
                    </span>{' '}
                    {movements[hoveredIndex].exited.slice(0, 5).join(', ')}
                    {movements[hoveredIndex].exited.length > 5 &&
                      ` y ${movements[hoveredIndex].exited.length - 5} más`}
                  </div>
                )}
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
