import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Contact QR Studio',
  description:
    'Create a vCard with all your contact details and download a styled QR code. Everything happens in your browser.',
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
