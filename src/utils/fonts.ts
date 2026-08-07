import { Inter, Noto_Sans_Devanagari } from 'next/font/google';
import localFont from 'next/font/local';

export const InterVar = Inter({
  weight: ['100', '300', '400', '500', '600', '700', '800', '900'],
  style: ['normal'],
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: false,
  variable: '--Inter',
});

export const NotoDevanagari = Noto_Sans_Devanagari({
  weight: ['100', '300', '400', '500', '600', '700', '800', '900'],
  style: ['normal'],
  subsets: ['latin'],
  display: 'swap',
  adjustFontFallback: false,
  variable: '--NotoDevanagari',
});
export const CustomIcons = localFont({
  src: '../../public/fonts/icomoon.woff',
  variable: '--CustomIcons',
  style: 'normal',
  display: 'swap',
});

/**
 * The icomoon set shipped inside @tulipstechnologies/common. The shared
 * DashboardSidebar/Header render icons as `<i className="icon icon-{name}" />`
 * and reference glyphs this module's own font does not carry, so both faces are
 * loaded and stacked in `styles/icon-font-stack.scss`.
 */
export const CommonIcons = localFont({
  src: '../../node_modules/@tulipstechnologies/common/dist/assets/fonts/icomoon.woff',
  variable: '--CommonIcons',
  style: 'normal',
  display: 'swap',
});
