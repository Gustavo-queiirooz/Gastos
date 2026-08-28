import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { DataProvider } from "@/context/DataContext";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Movimentacoes from "@/pages/Movimentacoes";
import Compromissos from "@/pages/Compromissos";
import Planejamento from "@/pages/Planejamento";
import Relatorios from "@/pages/Relatorios";

function App() {
  return (
    <DataProvider>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/movimentacoes" element={<Movimentacoes />} />
            <Route path="/compromissos" element={<Compromissos />} />
            <Route path="/planejamento" element={<Planejamento />} />
            <Route path="/relatorios" element={<Relatorios />} />
          </Routes>
        </Layout>
      </BrowserRouter>
      <Toaster position="top-center" richColors />
    </DataProvider>
  );
}

export default App;
