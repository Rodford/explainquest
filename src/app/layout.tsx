import type { ReactNode } from 'react';
import './globals.css';
export const metadata={title:'ExplainQuest — Learn it. Explain it. Master it.',description:'ExplainQuest study and AI feedback workspace'};
export default function RootLayout({children}:{children:ReactNode}){
  return <html lang="en"><body>{children}</body></html>;
}
