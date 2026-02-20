import { lazy, Suspense, type ReactNode } from "react";
import { createHashRouter } from "react-router-dom";
import RequireAuth from "./RequireAuth";
import RequireAdmin from "./RequireAdmin";

const AppLayout = lazy(() => import("../layout/AppLayout"));
const Login = lazy(() => import("../pages/Login/Login"));
const Dashboard = lazy(() => import("../pages/Dashboard/Dashboard"));
const Cliente = lazy(() => import("../pages/Cliente/Cliente"));
const Lixeira = lazy(() => import("../pages/Lixeira/Lixeira"));
const Operadores = lazy(() => import("../pages/Operadores/Operadores"));

function withRouteSuspense(element: ReactNode) {
  return <Suspense fallback={<div className="route-loading">Carregando...</div>}>{element}</Suspense>;
}

export const router = createHashRouter([
  { path: "/", element: withRouteSuspense(<Login />) },
  {
    path: "/app",
    element: withRouteSuspense(
      <RequireAuth>
        <AppLayout />
      </RequireAuth>,
    ),
    children: [
      { path: "dashboard", element: withRouteSuspense(<Dashboard />) },
      { path: "cliente/:id", element: withRouteSuspense(<Cliente />) },
      { path: "lixeira", element: withRouteSuspense(<Lixeira />) },
      {
        path: "operadores",
        element: withRouteSuspense(
          <RequireAdmin>
            <Operadores />
          </RequireAdmin>,
        ),
      },
    ],
  },
]);
