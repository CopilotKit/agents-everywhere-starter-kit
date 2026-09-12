import { NavLink, Route, Routes } from "react-router";
import { AgentPanel } from "./agent/AgentPanel";
import { ItemDetail, ItemsList } from "./pages/Items";
import { PurchaseOrderDetail, PurchaseOrdersList } from "./pages/PurchaseOrders";
import { RequisitionDetail } from "./pages/RequisitionDetail";
import { RequisitionsList } from "./pages/RequisitionsList";
import { SupplierDetail, SuppliersList } from "./pages/Suppliers";

const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: "/", label: "Requisitions", end: true },
  { to: "/suppliers", label: "Suppliers" },
  { to: "/items", label: "Items" },
  { to: "/purchase-orders", label: "Purchase Orders" },
];

export function App() {
  return (
    <div className="console">
      <nav className="console__panel" aria-label="Main">
        <div className="console__brand">
          <span className="console__brand-mark" aria-hidden="true" />
          <span className="console__brand-text">
            <span className="console__brand-name">Procurebot</span>
            <span className="console__brand-sub">ERP Console</span>
          </span>
        </div>
        <ul className="console__nav">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => "console__toggle" + (isActive ? " active" : "")}
              >
                <span className="console__toggle-dot" aria-hidden="true" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="printout">
        <Routes>
          <Route path="/" element={<RequisitionsList />} />
          <Route path="/requisitions/:id" element={<RequisitionDetail />} />
          <Route path="/suppliers" element={<SuppliersList />} />
          <Route path="/suppliers/:id" element={<SupplierDetail />} />
          <Route path="/items" element={<ItemsList />} />
          <Route path="/items/:id" element={<ItemDetail />} />
          <Route path="/purchase-orders" element={<PurchaseOrdersList />} />
          <Route path="/purchase-orders/:id" element={<PurchaseOrderDetail />} />
        </Routes>
      </main>
      <AgentPanel />
    </div>
  );
}
