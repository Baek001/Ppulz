export const runtime = 'edge';
import MarketBoardClient from '@/components/markets/MarketBoardClient';

export const metadata = {
  title: '마켓 보드 | Ppulz',
};

export const dynamic = 'force-dynamic';

export default function MarketsBoardPage() {
  return <MarketBoardClient />;
}
