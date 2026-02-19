'use client';

import styles from './Dashboard.module.css';

export default function ScoreGraphSvg({ data }) {
    // 1. Prepare Data
    const chartData = [...(data || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Dimensions
    const width = 100; // viewBox units
    const height = 50; // viewBox units
    const padding = 5;

    // Scales
    const minX = 0;
    const maxX = chartData.length > 1 ? chartData.length - 1 : 1;
    const minY = 0;
    const maxY = 100;

    const getX = (index) => (index / maxX) * (width - padding * 2) + padding;
    const getY = (score) => height - padding - (score / maxY) * (height - padding * 2);

    if (!chartData || chartData.length === 0) {
        return (
            <div className={styles.graphSection} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', height: '300px' }}>
                데이터가 없습니다.
            </div>
        );
    }

    // 2. Generate Path
    // Line commands
    const points = chartData.map((d, i) => `${getX(i)},${getY(d.score || 0)}`).join(' ');
    const linePath = `M ${points}`;

    // Area commands (close the loop)
    const areaPath = `${linePath} L ${getX(chartData.length - 1)},${height - padding} L ${getX(0)},${height - padding} Z`;

    return (
        <div className={styles.graphSection}>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
                <defs>
                    <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#3182f6" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#3182f6" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Grid Lines (Horizontal) */}
                <line x1={padding} y1={getY(0)} x2={width - padding} y2={getY(0)} stroke="#f0f0f0" strokeWidth="0.5" />
                <line x1={padding} y1={getY(50)} x2={width - padding} y2={getY(50)} stroke="#f0f0f0" strokeWidth="0.5" />
                <line x1={padding} y1={getY(100)} x2={width - padding} y2={getY(100)} stroke="#f0f0f0" strokeWidth="0.5" />

                {/* Area Fill */}
                <path d={areaPath} fill="url(#gradient)" stroke="none" />

                {/* Line Stroke */}
                <path d={linePath} fill="none" stroke="#3182f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Dots */}
                {chartData.map((d, i) => (
                    <circle
                        key={i}
                        cx={getX(i)}
                        cy={getY(d.score || 0)}
                        r="1.5"
                        fill="#3182f6"
                    />
                ))}

                {/* Labels (X-axis) */}
                {chartData.map((d, i) => (
                    <text
                        key={i}
                        x={getX(i)}
                        y={height - 1}
                        fontSize="3"
                        textAnchor="middle"
                        fill="#8b95a1"
                    >
                        {new Date(d.timestamp).getHours()}시
                    </text>
                ))}
            </svg>
        </div>
    );
}
