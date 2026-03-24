import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Path, Line, Text as SvgText, G } from 'react-native-svg';
import { Colors } from '@/constants/colors';

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  height?: number;
  width?: number;
}

export function BarChart({ data, maxValue, height = 180, width = 300 }: BarChartProps) {
  const max = maxValue || Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.floor((width - 40) / data.length) - 6;
  const chartHeight = height - 40;

  return (
    <Svg width={width} height={height}>
      {data.map((d, i) => {
        const barH = Math.max(4, (d.value / max) * chartHeight);
        const x = 20 + i * (barWidth + 6);
        const y = chartHeight - barH + 10;
        const color = d.color || Colors.accent;
        return (
          <G key={i}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              fill={color}
              rx={4}
              opacity={0.9}
            />
            <SvgText
              x={x + barWidth / 2}
              y={height - 4}
              textAnchor="middle"
              fontSize={9}
              fill={Colors.textMuted}
              fontFamily="Inter_400Regular"
            >
              {d.label}
            </SvgText>
            <SvgText
              x={x + barWidth / 2}
              y={y - 4}
              textAnchor="middle"
              fontSize={10}
              fill={Colors.textSecondary}
              fontFamily="Inter_600SemiBold"
            >
              {d.value}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

interface LineChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  width?: number;
}

export function LineChart({ data, color = Colors.gold, height = 150, width = 300 }: LineChartProps) {
  if (data.length < 2) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const min = Math.min(...data.map(d => d.value));
  const range = max - min || 1;
  const padLeft = 30;
  const padBottom = 30;
  const chartW = width - padLeft;
  const chartH = height - padBottom;
  const stepX = chartW / (data.length - 1);

  const points = data.map((d, i) => ({
    x: padLeft + i * stepX,
    y: 10 + chartH - ((d.value - min) / range) * chartH,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${points[points.length - 1].x},${height - padBottom + 10} L${points[0].x},${height - padBottom + 10} Z`;

  return (
    <Svg width={width} height={height}>
      <Path d={areaD} fill={color} opacity={0.1} />
      <Path d={pathD} stroke={color} strokeWidth={2.5} fill="none" />
      {points.map((p, i) => (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={4} fill={color} />
          <SvgText x={p.x} y={height - 8} textAnchor="middle" fontSize={9} fill={Colors.textMuted}>
            {data[i].label}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

interface PieChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
}

export function PieChart({ data, size = 160 }: PieChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const r = size / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;

  let cumAngle = -Math.PI / 2;
  const slices = data.map(d => {
    const angle = (d.value / total) * 2 * Math.PI;
    const start = cumAngle;
    cumAngle += angle;
    const end = cumAngle;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
    return { path, color: d.color, label: d.label, value: d.value, pct: Math.round((d.value / total) * 100) };
  });

  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <Svg width={size} height={size}>
        {slices.map((s, i) => (
          <Path key={i} d={s.path} fill={s.color} opacity={0.9} />
        ))}
      </Svg>
      <View style={styles.legend}>
        {slices.map((s, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label} ({s.pct}%)</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}

export function DonutChart({ data, size = 160, thickness = 28, centerLabel, centerSub }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const r = size / 2 - thickness / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const GAP = 0.025;

  let cumAngle = -Math.PI / 2;
  const slices = data.map(d => {
    const fraction = d.value / total;
    const angle = fraction * 2 * Math.PI - GAP;
    const start = cumAngle + GAP / 2;
    cumAngle += fraction * 2 * Math.PI;
    const end = start + angle;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)}`;
    return { path, color: d.color, label: d.label, value: d.value, pct: Math.round((d.value / total) * 100) };
  });

  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {slices.map((s, i) => (
            <Path
              key={i}
              d={s.path}
              stroke={s.color}
              strokeWidth={thickness}
              fill="none"
              strokeLinecap="round"
              opacity={0.92}
            />
          ))}
          {centerLabel ? (
            <G>
              <SvgText
                x={cx}
                y={cy - 6}
                textAnchor="middle"
                fontSize={20}
                fontFamily="Inter_700Bold"
                fill={Colors.text}
              >
                {centerLabel}
              </SvgText>
              {centerSub ? (
                <SvgText
                  x={cx}
                  y={cy + 12}
                  textAnchor="middle"
                  fontSize={10}
                  fontFamily="Inter_400Regular"
                  fill={Colors.textMuted}
                >
                  {centerSub}
                </SvgText>
              ) : null}
            </G>
          ) : null}
        </Svg>
      </View>
      <View style={styles.legend}>
        {slices.map((s, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label} · {s.value} ({s.pct}%)</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
});
