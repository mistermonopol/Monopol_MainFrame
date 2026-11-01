import "./globals.css";
import "./layouts.css";
export const metadata = {
  title: "Monopol_MainFrame",
  description: "Monopol_MainFrame your App for Everything",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.theme=['dark','light','amber','cyan'].includes(localStorage.getItem('monopol-theme'))?localStorage.getItem('monopol-theme'):'dark';document.documentElement.dataset.layout=['index','studio','control','focus'].includes(localStorage.getItem('monopol-layout'))?localStorage.getItem('monopol-layout'):'index';document.documentElement.lang=localStorage.getItem('monopol-language')==='de'?'de':'en'}catch(e){}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
