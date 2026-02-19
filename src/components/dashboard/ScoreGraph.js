'use client';

import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';
import styles from './Dashboard.module.css';

function getScoreColor(score) {
    const numericScore = Number(score);

    if (!Number.isFinite(numericScore)) return '#3182f6';
    if (numericScore >= 63) return '#16c47f';
    if (numericScore >= 40) return '#ffb800';
    return '#f04452';
}

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const value = payload[0]?.value;
        const scoreColor = getScoreColor(value);

        return (
            <div
                style={{
                    backgroundColor: '#fff',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                    border: 'none',
                    fontSize: '14px',
                    minWidth: '100px'
                }}
            >
                <p style={{ margin: 0, color: '#6b7684', fontSize: '12px' }}>
                    {label ? `${new Date(label).getHours()}시` : ''}
                </p>
                <p style={{ margin: '4px 0 0', color: scoreColor, fontWeight: 'bold', fontSize: '18px' }}>
                    {`${value}점`}
                </p>
            </div>
        );
    }
    return null;
};

export default function ScoreGraph({ data }) {
    const chartData = [...(data || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    if (!chartData || chartData.length === 0) {
        return (
            <div
                className={styles.graphSection}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', height: '300px' }}
            >
                아직 분석 데이터가 없습니다.
            </div>
        );
    }

    if (chartData.length === 1) {
        const onlyPoint = chartData[0];
        const pointDate = onlyPoint?.timestamp ? new Date(onlyPoint.timestamp) : null;
        const pointTimeText =
            pointDate && !Number.isNaN(pointDate.getTime())
                ? `${pointDate.getHours()}시 기준`
                : '시간 정보 없음';
        const onlyScoreColor = getScoreColor(onlyPoint.score);

        return (
            <div
                className={styles.graphSection}
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    color: '#6b7684',
                    height: '300px',
                }}
            >
                <p style={{ margin: 0, fontSize: '14px', textAlign: 'center' }}>
                    초기 분석 데이터 수집 중입니다. 잠시 후 그래프가 완성됩니다.
                </p>
                <div
                    style={{
                        display: 'inline-flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderRadius: '12px',
                        border: '1px solid #d9e0e6',
                        backgroundColor: '#f8fafc',
                    }}
                >
                    <strong style={{ fontSize: '24px', lineHeight: 1.2, color: onlyScoreColor }}>
                        {`${onlyPoint.score ?? '-'}점`}
                    </strong>
                    <span style={{ fontSize: '12px', color: '#8b95a1' }}>{pointTimeText}</span>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.graphSection}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                    data={chartData}
                    margin={{
                        top: 10,
                        right: 10,
                        left: -20,
                        bottom: 0
                    }}
                >
                    <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3182f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3182f6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                        dataKey="timestamp"
                        tickFormatter={(value) => {
                            if (!value) return '';
                            const date = new Date(value);
                            return Number.isNaN(date.getTime()) ? '' : `${date.getHours()}시`;
                        }}
                        tick={{ fontSize: 12, fill: '#8b95a1' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 12, fill: '#8b95a1' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#3182f6"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorScore)"
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#3182f6' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
