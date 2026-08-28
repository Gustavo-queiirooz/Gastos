# PRD — Meu Bolso (Controle e Planejamento Financeiro Pessoal)

## Problema / Visão
App web responsivo (mobile-first) de controle e planejamento financeiro pessoal, uso individual, PT-BR / R$. O diferencial é o **motor financeiro** que separa claramente gasto realizado, compromisso futuro, gasto fixo, parcela, valor a receber, dívida, necessidade, meta e investimento. Métrica herói: **Disponível real = Saldo atual − Comprometido**.

## Arquitetura
- **Backend**: FastAPI + MongoDB (uuid string ids, sem ObjectId). Módulos: `db.py`, `models.py`, `engine.py` (cálculos), `server.py` (rotas). Todas as rotas com prefixo `/api`. Sem autenticação (uso individual, requisito de privacidade).
- **Frontend**: React 19 + Tailwind + shadcn/ui + Phosphor icons + Recharts. Tema "Organic & Earthy" (verde profundo, terracota, Manrope/DM Sans). Navegação inferior (mobile) / sidebar (desktop) com 5 áreas.
- **Motor**: `compute_current_balance` = Σ saldo inicial contas + entradas − gastos. `compute_committed` = Σ compromissos a_vencer/atrasado. Parcelas e recorrentes geram compromissos (sem duplicar total). Pagar compromisso cria gasto; receber recebível cria entrada.

## Personas
- Indivíduo que quer enxergar quanto realmente pode gastar, controlar dívidas, parcelas, contas divididas e planejar o futuro.

## Requisitos core (estáticos)
Dashboard projetado, Entradas, Gastos (rápido, atalhos, dividido, parcelado), Categorias, Contas, Cartões, Gastos fixos/recorrentes, Vencimentos (filtros), Contas atrasadas, Divididos, Empréstimos/Dívidas, Necessidades (prioridades), Metas, Desafio 365 dias, Planejamento mensal, Relatórios, Posso comprar?, Backup/Export/Import.

## Implementado (2026-08-28)
- ✅ Motor financeiro completo e verificado (27/27 testes backend, sem duplicidade)
- ✅ Dashboard com Disponível real, stats do mês, próximos vencimentos, áreas de acesso rápido, alerta de atrasadas
- ✅ Modal rápido "+ Lançar" (gasto/entrada, atalhos, dividir, parcelar em cartão)
- ✅ Movimentações: gastos, entradas, divididos, contas, cartões, categorias, pessoas (CRUD)
- ✅ Compromissos: vencimentos com filtros (hoje/7/30/90/180/365d), atrasadas, gastos fixos (gera 12 meses), parcelamentos, empréstimos (pego/emprestei), a receber
- ✅ Planejamento: previsão 12 meses com saldo projetado + alertas, necessidades (prioridades, realizar→gasto), metas (progresso, guardar), desafio 365 (grid, inverter), Posso comprar? (verde/amarelo/vermelho com justificativa)
- ✅ Relatórios: gastos por categoria (pizza), entradas vs gastos por mês (barras), por forma de pagamento, insights, custo do carro (mês/ano), investimentos, backup export/import/reset

## Backlog (próximas fases)
- P1: Radar de investimentos com dados atualizados da internet; notificações/alertas push; bloqueio por senha/biometria
- P2: Sincronização em nuvem; multiusuário; simulador de investimentos; desafios personalizados
- Melhoria: mover `refresh_overdue` para tarefa agendada; índices únicos em `id`; validação de schema no import de backup

## Notas
- App sem login por design (privacidade). Backup manual via JSON.
