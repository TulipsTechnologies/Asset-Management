import type { Metadata } from 'next';
// Order matters: the local globals own `@tailwind base/components/utilities`,
// the shared stylesheet layers the common component styles on top, and the icon
// font stack comes last so it wins over both.
import '../styles/globals.scss';
import '@tulipstechnologies/common/dist/styles/globals.scss';
import '@/styles/icon-font-stack.scss';
// LAST on purpose. The vendored sheet sets its focus ring with !important, so only a later
// import of equal specificity can replace it — see the note in focus-ring.scss.
import '@/styles/focus-ring.scss';
import { CommonIcons, CustomIcons, InterVar, NotoDevanagari } from '@/utils/fonts';
import RootProvider from '@/components/Providers/RootProvider';

/**
 * `title.template` gives every route its own document title (WCAG 2.4.2).
 *
 * Previously this was a single static string, so all 37 routes announced
 * "TulipsHRM - Asset Management" — a screen-reader user tabbing between browser tabs, and
 * anyone reading their own history or bookmarks, could not tell one screen from another.
 * A route now sets `export const metadata = { title: 'Assets' }` and gets
 * "Assets · TulipsHRM Asset Management"; `default` covers any route that sets nothing.
 */
export const metadata: Metadata = {
  title: {
    template: '%s · TulipsHRM Asset Management',
    default: 'TulipsHRM - Asset Management',
  },
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
        {/* Skip link (WCAG 2.4.1). Visually hidden until focused, then the first Tab on any
            page offers a jump past the sidebar menu tree and header straight to the content.
            Targets the <main id="main-content"> in DashboardContents. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[10100] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-secondaryColor focus:shadow-lg"
        >
          Skip to main content
        </a>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
