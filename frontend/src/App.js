import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { DataProvider } from "@/context/DataContext";
import Layout from "@/components/Layout";
import AppLock from "@/components/AppLock";
import Dashboard from "@/pages/Dashboard";
import Movimentacoes from "@/pages/Movimentacoes";
import Compromissos from "@/pages/Compromissos";
import Planejamento from "@/pages/Planejamento";
import Relatorios from "@/pages/Relatorios";

function App() {
  return (
    <AppLock>
      <DataProvider>
        <BrowserRouter basename="/Gastos">
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/movimentacoes" element={<Movimentacoes />} />
              <Route path="/compromissos" element={<Compromissos />} />
              <Route path="/planejamento" element={<Planejamento />} />
              <Route path="/relatorios" element={<Relatorios />} />

              {/* Qualquer rota desconhecida volta para o Início */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </DataProvider>

      <Toaster position="top-center" richColors />
    </AppLock>
  );
}

export default App;
