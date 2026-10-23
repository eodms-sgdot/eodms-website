import type { FilterValue, STACQueryable } from "../types";

const getQueryableType = (queryable: STACQueryable): string | undefined =>
  Array.isArray(queryable.type)
    ? queryable.type.find(typeName => typeName !== "null")
    : queryable.type ?? undefined;

export const getQueryableChoices = (queryable: STACQueryable) =>
  queryable.enum?.length ? queryable.enum : queryable.items?.enum;

export const hasGeometryValidityQueryable = (
  queryables: Record<string, STACQueryable>,
): boolean => {
  const queryable = queryables.geometry_valid;
  return Boolean(queryable && getQueryableType(queryable) === "boolean");
};

export const buildGeometryValidityFilter = (
  queryablesByCollection: Array<Record<string, STACQueryable>>,
): string => {
  const supportingCollections = queryablesByCollection.filter(hasGeometryValidityQueryable).length;

  if (supportingCollections === 0) return "";
  if (supportingCollections === queryablesByCollection.length) return "geometry_valid = TRUE";
  return "(geometry_valid = TRUE OR geometry_valid IS NULL)";
};

export const isFilterAllowedByQueryables = (
  filterValue: FilterValue,
  queryables?: Record<string, STACQueryable>,
): boolean => {
  if (filterValue.fieldKey === "geometry_valid") return false;
  if (!queryables) return true;

  const queryable = queryables[filterValue.fieldKey];
  if (!queryable) return false;

  const choices = getQueryableChoices(queryable);
  if (choices?.length) {
    const expectedOperation = filterValue.value === null ? "IS NULL" : "=";
    return choices.some(choice => Object.is(choice, filterValue.value)) &&
      filterValue.operation === expectedOperation;
  }

  const queryableType = getQueryableType(queryable);
  if (queryableType === "integer" || queryableType === "number") return filterValue.type === "number";
  if (queryableType === "boolean") return filterValue.type === "boolean";
  if (queryableType === "string") {
    return filterValue.type === "string" || filterValue.type === "duration" || filterValue.type === "date-range";
  }
  return false;
};

export const buildQueryableFilterClauses = (
  filters: FilterValue[] = [],
  queryables?: Record<string, STACQueryable>,
): string[] => {
  const clauses: string[] = [];


  for (const filterValue of filters) {
    const { fieldKey, operation, type, value } = filterValue;
    if (!isFilterAllowedByQueryables(filterValue, queryables)) continue;
    if (!operation || value === undefined || value === "") continue;

    if (value === null) {
      if (operation === "IS NULL" || operation === "=") clauses.push(`${fieldKey} IS NULL`);
    } else if (type === "string") {
      clauses.push(`${fieldKey} ${operation} '${value.toString().replace(/'/g, "''")}'`);
    } else if (type === "number") {
      clauses.push(`${fieldKey} ${operation} ${value.toString()}`);
    } else if (type === "boolean") {
      clauses.push(`${fieldKey} ${operation} ${value ? "TRUE" : "FALSE"}`);
    }
  }

  return clauses;
};