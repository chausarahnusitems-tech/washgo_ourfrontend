import "leaflet/dist/leaflet.css";
import "./globals.css";
import { AppProvider } from "../lib/AppContext.jsx";
import { AppShell } from "../components/layout/AppShell.jsx";

export const metadata = {
  title: "Washgo",
  icons: { icon: "/icons/washgologo.svg" }
};

export const viewport = {
  themeColor: "#ef3124",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
