import "./globals.css";

export const metadata = {
  title: "TaskPilot",
  description: "Manage Taiga tasks and MH Connekt timesheets from WhatsApp.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
