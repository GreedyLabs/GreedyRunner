import { pm25Level, pm10Level, o3Level, tempLevel, humidityLevel, uvLevel } from '../../../lib/conditionLevels';
import { TONE_CLASSES } from '../../../lib/runningStatusColors';
import type { AirQualityMetrics, WeatherInfo } from '../../../domain/entities/airQuality.types';
import { cn } from '../../../lib/cn';

interface ConditionGridProps {
  airQuality: AirQualityMetrics;
  weather?: WeatherInfo;
}

interface Tile {
  label: string;
  value: string;
  level: { label: string; tone: keyof typeof TONE_CLASSES };
}

export function ConditionGrid({ airQuality, weather }: ConditionGridProps) {
  const airTiles: Tile[] = [
    { label: '초미세', value: airQuality.pm25 == null ? '—' : String(airQuality.pm25), level: pm25Level(airQuality.pm25) },
    { label: '미세', value: airQuality.pm10 == null ? '—' : String(airQuality.pm10), level: pm10Level(airQuality.pm10) },
    { label: '오존', value: airQuality.o3 == null ? '—' : String(Math.round(airQuality.o3 * 1000)), level: o3Level(airQuality.o3) },
  ];

  const weatherTiles: Tile[] = weather
    ? [
        { label: '기온', value: `${weather.temperature}°`, level: tempLevel(weather.temperature) },
        { label: '습도', value: `${weather.humidity}%`, level: humidityLevel(weather.humidity) },
        { label: '자외선', value: weather.uvIndex == null ? '—' : String(weather.uvIndex), level: uvLevel(weather.uvIndex) },
      ]
    : [];

  const tiles = [...airTiles, ...weatherTiles];

  return (
    <div className="bg-panel border border-line rounded-3xl px-4 py-1">
      <div className="grid grid-cols-3">
        {tiles.map((tile, i) => {
          const isRow1 = i < 3;
          const isLeftCols = i % 3 !== 2;
          return (
            <div
              key={tile.label}
              className={cn(
                'px-1.5 py-3.5',
                isRow1 && tiles.length > 3 && 'border-b border-line',
                isLeftCols && 'border-r border-line'
              )}
            >
              <p className="text-[11px] text-muted mb-0.5">{tile.label}</p>
              <p className="text-xl font-bold">{tile.value}</p>
              <p className={cn('text-[11px] font-semibold mt-0.5', TONE_CLASSES[tile.level.tone].text)}>
                {tile.level.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
