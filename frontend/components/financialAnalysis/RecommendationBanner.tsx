'use client';

interface RecommendationProps {
  data: {
    message: string | null;
    maxPct: number;
    ppAvg: number;
    avgSal: number;
    capPeriod: number;
    pctActual?: number;
    participants?: number;
    freq?: string;
  };
}

function fU(n: number): string {
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? '-$' : '$') + abs.toLocaleString('en-US');
}

export function RecommendationBanner({ data }: RecommendationProps) {
  if (data.message) {
    return (
      <div className="rounded-lg border border-blue-500 bg-gradient-to-r from-blue-500/10 to-green-500/10 p-3 text-xs leading-relaxed">
        <b className="text-blue-500">{data.message}</b>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-500 bg-gradient-to-r from-blue-500/10 to-green-500/10 p-3 text-xs leading-relaxed">
      <b className="text-blue-500">Recomendación:</b> Max % variable que cabe en el cap ={' '}
      <b className="text-blue-500">{(data.maxPct * 100).toFixed(1)}%</b>. Con el{' '}
      {((data.pctActual || 0) * 100).toFixed(1)}% actual, cada participante recibe en promedio{' '}
      <b className="text-blue-500">{fU(data.ppAvg)}</b>/periodo ({data.freq}).
      <br />
      {data.participants} participantes, sueldo promedio participante: {fU(data.avgSal)}/mes, cap
      individual: {fU(data.capPeriod)}/periodo.
    </div>
  );
}
