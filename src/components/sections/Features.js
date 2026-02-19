import styles from './Features.module.css';

const FEATURES = [
    {
        title: "?쇰줈???녿뒗 ?댁뒪 ?뚮퉬",
        desc: "?먭레?곸씤 ?ㅻ뱶?쇱씤??吏移섏뀲?섏슂?\n?듭떖留??댁? ?먯닔濡??몄긽???먮쫫???쎌쑝?몄슂."
    },
    {
        title: "?쒓뎅/誘멸뎅 ?좏샇 ?듯빀",
        desc: "援?궡 ?댁뒋遺??湲濡쒕쾶 ?몃젋?쒓퉴吏,\nPpulz ?섎굹濡?紐⑤몢 ?뚯븙?????덉뒿?덈떎."
    },
    {
        title: "留ㅼ떆媛??낅뜲?댄듃",
        desc: "蹂?뷀븯???щ줎怨?踰뺤븞???吏곸엫??n?ㅼ떆媛꾩뿉 媛源앷쾶 ?ъ갑?⑸땲??"
    },
    {
        title: "洹쇨굅???꾩슂???뚮쭔",
        desc: "?먰룊臾멸낵 異쒖쿂???대┃ ??踰덉쑝濡?\n?됱냼??吏곴??곸씤 ?붿빟留?蹂댁꽭??"
    }
];

export default function Features() {
    return (
        <section id="features" className={styles.section}>
            <div className={`container ${styles.container}`}>
                <h2 className={styles.sectionTitle}>
                    ??<span className={styles.logo}>Ppulz</span>?ъ빞 ?좉퉴??
                </h2>

                <div className={styles.grid}>
                    {FEATURES.map((item, idx) => (
                        <div key={idx} className={styles.card}>
                            <h3 className={styles.cardTitle}>{item.title}</h3>
                            <p className={styles.cardDesc}>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}


