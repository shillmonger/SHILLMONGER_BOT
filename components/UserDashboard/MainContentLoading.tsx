"use client";

import { createContext, useContext } from "react";

/**
 * Lets deeply nested client pages report that they are still fetching data,
 * so the UserDashboard layout can keep the ShillmongerLoader overlay visible
 * until the content is actually ready.
 */
export const MainContentLoadingContext = createContext<(loading: boolean) => void>(
  () => {}
);

export function useMainContentLoading() {
  return useContext(MainContentLoadingContext);
}
