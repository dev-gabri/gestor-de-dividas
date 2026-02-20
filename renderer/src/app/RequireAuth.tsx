import type { JSX } from "react";
import { Navigate } from "react-router-dom";
import { getSession } from "../lib/auth";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const session = getSession();
  if (!session) return <Navigate to="/" replace />;
  return children;
}
