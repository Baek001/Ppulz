import './globals.css';

export const metadata = {
  title: 'Ppulz - 뉴스/법안 신호 탐색',
  description: '뉴스와 법안 데이터를 분석해 관심 영역의 흐름을 확인하는 서비스',
};

export default function RootLayout({ children }) {
  return (
    <html lang='ko'>
      <body>{children}</body>
    </html>
  );
}

