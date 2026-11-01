import "./globals.css";
export const metadata = {
  title: "Everything · Dein Life OS",
  description: "Dein Tag. Dein Leben. Ein Ort.",
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
