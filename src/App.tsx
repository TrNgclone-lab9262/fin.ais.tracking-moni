import { FinanceProvider } from "@/context/FinanceContext";
import { PWAUpdateProvider } from "@/context/PWAUpdateContext";
import HomePage from "@/app/page";

export default function App() {
  return (
    <PWAUpdateProvider>
      <FinanceProvider>
        <HomePage />
      </FinanceProvider>
    </PWAUpdateProvider>
  );
}
