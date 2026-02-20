import type { JSX } from "react";
import { Navigate } from "react-router-dom";
import { getSession } from "../lib/auth";

export default function RequireAdmin({ children }: { children: JSX.Element }) {
  const s = getSession();
  if (!s) return <Navigate to="/" replace />;
  if (s.role !== "admin") return <Navigate to="/app/dashboard" replace />;
  return children;
}
