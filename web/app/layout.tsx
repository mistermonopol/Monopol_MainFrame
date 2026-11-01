import "./globals.css";
export const metadata = {
  title: "Monopol_MainFrame",
  description: "Dein persönlicher Workspace für Alltag und Projekte.",
};
export default function Layout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
