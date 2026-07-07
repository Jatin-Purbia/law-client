import { Inter, Noto_Serif_Devanagari } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const serifDevanagari = Noto_Serif_Devanagari({
  subsets: ['devanagari', 'latin'],
  variable: '--font-devanagari',
  weight: ['400', '500', '600', '700'],
});

export const metadata = {
  title: 'Agreement Studio',
  description: 'Next.js version of the agreement drafting workspace',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${serifDevanagari.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
