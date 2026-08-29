import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "@/lib/finance";

const DataCtx = createContext(null);
export const useData = () => useContext(DataCtx);

export function DataProvider({ children }) {
  const [dashboard, setDashboard] = useState({
    month: "",
    available: 0,
    current_balance: 0,
    committed: 0,
    income_month: 0,
    expense_month: 0,
    overdue_count: 0,
    overdue_total: 0,
    upcoming: [],
    to_receive: 0,
    debts: 0,
    needs_count: 0,
    needs_total: 0,
    goals_saved: 0,
    goals_target: 0,
    invest_current: 0,
    invested_total: 0,
  });

  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [cards, setCards] = useState([]);
  const [people, setPeople] = useState([]);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const loadStatic = useCallback(async () => {
    const [c, a, cd, p] = await Promise.all([
      api.get("/categories"),
      api.get("/accounts"),
      api.get("/cards"),
      api.get("/people"),
    ]);

    setCategories(c);
    setAccounts(a);
    setCards(cd);
    setPeople(p);
  }, []);

  useEffect(() => {
    api.get("/dashboard").then(setDashboard).catch(() => {});
    loadStatic();
  }, [tick, loadStatic]);

  return (
    <DataCtx.Provider
      value={{
        dashboard,
        categories,
        accounts,
        cards,
        people,
        refresh,
        tick,
        loadStatic,
      }}
    >
      {children}
    </DataCtx.Provider>
  );
}
