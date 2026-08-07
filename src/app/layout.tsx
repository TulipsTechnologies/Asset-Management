import type { Metadata } from 'next';
import '../styles/globals.scss';
import { CustomIcons, InterVar, NotoDevanagari } from '@/utils/fonts';
import RootProvider from '@/components/Providers/RootProvider';

export const metadata: Metadata = {
  title: 'TulipsHRM - Asset Management',
  description: 'TulipsHRM - Asset Management',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/asset-management/tulipshrm-favicon.png" type="image/x-icon" />
        <link
          rel="shortcut icon"
          href="/asset-management/tulipshrm-favicon.png"
          type="image/x-icon"
        />
      </head>
      <body
        className={`${InterVar.variable} ${NotoDevanagari.variable} ${CustomIcons.variable} h-screen overflow-y-hidden`}
      >
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
