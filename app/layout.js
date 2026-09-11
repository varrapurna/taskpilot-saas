import "./globals.css";

export const metadata = {
  title: "TaskPilot",
  description: "Manage Taiga tasks and MH Connekt timesheets from WhatsApp.",
  icons: {
    icon: "/taskpilot-icon.png",
    shortcut: "/taskpilot-icon.png",
    apple: "/taskpilot-icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
