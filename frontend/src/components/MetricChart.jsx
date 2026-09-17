import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

const SOURCE_COLORS = {
  GBIF: '#2f8f5b',
  'NASA POWER': '#2f7ea8',
  'IPCC Tier 1': '#b8703f',
  PostGIS: '#64766c',
};

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });
const YEAR_LABEL = new Intl.DateTimeFormat('en-US', { year: 'numeric' });

export function ProvenanceBadge({ source, isModeled }) {
  return (
    <span className="chip">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: SOURCE_COLORS[source] ?? '#64766c' }}
      />
      {source}
      {isModeled && <span className="text-clay-500">· modelled</span>}
    </span>
  );
}

function labelFormatter(points) {
  const distinctYears = new Set(points.map((p) => p.date.slice(0, 4))).size;
  const isYearly = distinctYears === points.length;

  return (point) => {
    const date = new Date(point.date);
    return isYearly ? YEAR_LABEL.format(date) : MONTH_LABEL.format(date);
  };
}

export default function MetricChart({ series }) {
  const points = series.points ?? [];

  if (points.length === 0) {
    return (
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold">{series.label}</h3>
          <ProvenanceBadge source={series.source} isModeled={series.is_modeled} />
        </div>
        <p className="mt-8 text-center text-sm text-muted">No data available for this polygon.</p>
      </div>
    );
  }

  const color = SOURCE_COLORS[series.source] ?? '#2f8f5b';
  const format = labelFormatter(points);
  const values = points.map((p) => p.value);
  const latest = values[values.length - 1];

  const data = {
    labels: points.map(format),
    datasets: [
      {
        label: `${series.label} (${series.unit})`,
        data: values,
        borderColor: color,
        backgroundColor: (context) => {
          const { ctx, chartArea } = context.chart;
          if (!chartArea) return `${color}14`;
          const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          gradient.addColorStop(0, `${color}33`);
          gradient.addColorStop(1, `${color}03`);
          return gradient;
        },
        borderWidth: 2,
        borderDash: series.is_modeled ? [5, 4] : undefined,
        pointRadius: points.length > 30 ? 0 : 2,
        pointHoverRadius: 5,
        pointBackgroundColor: color,
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        tension: 0.32,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0e1a14',
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        titleFont: { size: 11, weight: '500' },
        bodyFont: { size: 12, weight: '600' },
        callbacks: {
          label: (ctx) => `${ctx.parsed.y?.toLocaleString()} ${series.unit}`,
        },
      },
    },
    scales: {
      x: {
        border: { display: false },
        grid: { display: false },
        ticks: { maxTicksLimit: 7, font: { size: 10 }, color: '#93a39a', maxRotation: 0 },
      },
      y: {
        border: { display: false },
        beginAtZero: false,
        grid: { color: '#eef2ef' },
        ticks: { maxTicksLimit: 5, font: { size: 10 }, color: '#93a39a' },
      },
    },
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold leading-snug">{series.label}</h3>
          <p className="mt-0.5 text-xs text-muted">
            <span className="font-medium tabular-nums text-body">
              {latest?.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </span>{' '}
            {series.unit} · latest of {points.length}
          </p>
        </div>
        <ProvenanceBadge source={series.source} isModeled={series.is_modeled} />
      </div>

      <div className="mt-4 h-44">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
