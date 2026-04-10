import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ShambaDrop',
  description: 'Connecting Kenyan Agriculture',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}