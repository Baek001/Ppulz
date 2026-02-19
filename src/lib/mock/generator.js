// Deterministic Random Number Generator (Mulberry32)
// Seeded by user_id + sub_category string to ensure consistent results per refresh.
function mulberry32(a) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function stringToSeed(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0; // Convert to 32bit integer
    }
    return hash; // Math.abs? No, mulberry handles int32.
}

function getComment(score) {
    if (score >= 80) return "오늘은 완전 꿀이네 (상승세)";
    if (score >= 60) return "긍정적인 신호가 보입니다";
    if (score >= 40) return "흔들리긴 하는데 애매하다";
    if (score >= 20) return "주의가 필요한 시점입니다 (하락세)";
    return "윽, 이건 너무 별론데 (위험)";
}

export function generateMockSeries(userId, subCategory) {
    // 1. Create Seed
    const seedString = `${userId}-${subCategory}`;
    const seed = stringToSeed(seedString);
    const rand = mulberry32(seed);

    // 2. Generate 3 Data Points (Now - 2h, Now - 1h, Now)
    const series = [];
    const now = new Date();

    // Base score determined by seed (so specific categories tend to look specific ways)
    let currentScore = Math.floor(rand() * 100);

    for (let i = 2; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60 * 60 * 1000); // i hours ago

        // Vary score slightly but keep trend
        const variation = Math.floor(rand() * 20) - 10; // -10 to +10
        currentScore = Math.max(0, Math.min(100, currentScore + variation));

        // Occasional spike/drop logic (10% chance)
        if (rand() > 0.9) {
            currentScore = rand() > 0.5 ? 90 : 10;
        }

        series.push({
            timestamp: time.toISOString(),
            score: currentScore,
            label: `${currentScore}점`,
            comment: getComment(currentScore)
        });
    }

    return series;
}
