import type { Route } from "next";

/** Converte URLs dinâmicas validadas em Route para compatibilidade com typedRoutes. */
export function asRoute(value: string): Route {
  return value as Route;
}
