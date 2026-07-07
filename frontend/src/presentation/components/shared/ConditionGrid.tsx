import { pm25Level, pm10Level, o3Level, tempLevel, humidityLevel, uvLevel, windLevel, precipitationLevel } from '../../../lib/conditionLevels';
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

  const precip = weather ? precipitationLevel(weather.precipitation) : null;
  const weatherTiles: Tile[] = weather
    ? [
        { label: '기온', value: `${weather.temperature}°`, level: tempLevel(weather.temperature) },
        { label: '습도', value: `${weather.humidity}%`, level: humidityLevel(weather.humidity) },
        { label: '자외선', value: weather.uvIndex == null ? '—' : String(weather.uvIndex), level: uvLevel(weather.uvIndex) },
        { label: '풍속', value: `${weather.windSpeed}㎧`, level: windLevel(weather.windSpeed) },
        { label: '강수', value: precip!.value, level: precip!.level },
      ]
    : [];

  const tiles = [...airTiles, ...weatherTiles];

  return (
    <div className="bg-panel border border-line rounded-3xl py-1">
      <div className="grid grid-cols-3">
        {tiles.map((tile, i) => {
          // 3열 그리드에서 칸 수가 3의 배수가 아니어도(예: 8칸) 구분선이 어긋나지 않도록
          // 마지막 행/열을 동적으로 계산한다.
          const lastRowStart = tiles.length - (tiles.length % 3 || 3);
          const isLastRow = i >= lastRowStart;
          const isRightCol = i % 3 === 2;
          const isLastTile = i === tiles.length - 1;
          return (
            <div
              key={tile.label}
              // 좌우 여백을 셀에 균일하게(px-4) 두어 모든 칸의 콘텐츠 들여쓰기를 맞춘다.
              // (컨테이너 가로 패딩을 두면 1열만 더 들여써져 칸마다 여백이 달라 보였음)
              className={cn(
                'px-4 py-3.5',
                !isLastRow && 'border-b border-line',
                !isRightCol && !isLastTile && 'border-r border-line'
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
