import { createHashRouter } from "react-router-dom";
import AppLayout from "../layout/AppLayout";
import Login from "../pages/Login/Login";
import Dashboard from "../pages/Dashboard/Dashboard";
import Cliente from "../pages/Cliente/Cliente";
import Lixeira from "../pages/Lixeira/Lixeira";
import Operadores from "../pages/Operadores/Operadores";
import RequireAuth from "./RequireAuth";
import RequireAdmin from "./RequireAdmin";

export const router = createHashRouter([
  { path: "/", element: <Login /> },
  {
    path: "/app",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { path: "dashboard", element: <Dashboard /> },
      { path: "cliente/:id", element: <Cliente /> },
      { path: "lixeira", element: <Lixeira /> },
      {
        path: "operadores",
        element: (
          <RequireAdmin>
            <Operadores />
          </RequireAdmin>
        ),
      },
    ],
  },
]);
