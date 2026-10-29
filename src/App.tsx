import { FinanceProvider } from "@/context/FinanceContext";
import HomePage from "@/app/page";

export default function App() {
  return (
    <FinanceProvider>
      <HomePage />
    </FinanceProvider>
  );
}
