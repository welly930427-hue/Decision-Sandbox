import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Simulator from "@/pages/Simulator";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Simulator />
    </QueryClientProvider>
  );
}

export default App;
