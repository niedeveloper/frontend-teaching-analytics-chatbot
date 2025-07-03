import "../styles/global.css";
import { UserProvider } from "../context/UserContext";

export const metadata = {
  title: "Teaching Analytics Chatbot",
  description: "A Next.js chatbot analytics dashboard",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <UserProvider>{children}</UserProvider>
      </body>
    </html>
  );
}
