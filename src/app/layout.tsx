import type { Metadata } from 'next';
// Order matters: the local globals own `@tailwind base/components/utilities`,
// the shared stylesheet layers the common component styles on top, and the icon
// font stack comes last so it wins over both.
import '../styles/globals.scss';
import '@tulipstechnologies/common/dist/styles/globals.scss';
import '@/styles/icon-font-stack.scss';
import { CommonIcons, CustomIcons, InterVar, NotoDevanagari } from '@/utils/fonts';
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
        className={`${InterVar.variable} ${NotoDevanagari.variable} ${CustomIcons.variable} ${CommonIcons.variable} h-dvh overflow-y-hidden`}
      >
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
