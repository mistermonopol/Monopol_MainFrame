import "./globals.css";
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
              "try{document.documentElement.dataset.theme=localStorage.getItem('monopol-theme')==='light'?'light':'dark';document.documentElement.lang=localStorage.getItem('monopol-language')==='de'?'de':'en'}catch(e){}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
