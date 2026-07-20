import { RoteIds } from "../types";

export const checkPermission = (permissions: Record<string, string> | null, routeIds: RoteIds[], condition : "or" | "and" = "and") : boolean => {
  if (permissions == null) return false;
  if(condition == "and") {
    return routeIds.every(value => value in permissions)
  }
  if(condition == "or") return routeIds.some(value => value in permissions);
  return false
};