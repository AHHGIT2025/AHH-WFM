/**
 * Client-side fetch wrappers for Master Data API routes.
 */

export async function fetchActiveCompanies() {
  const res = await fetch("/api/v1/companies");
  if (!res.ok) throw new Error("Failed to fetch companies");
  const data = await res.json();
  return data.data || [];
}

export async function fetchDepartmentsByCompany(companyId: string) {
  if (!companyId) return [];
  const res = await fetch(`/api/v1/departments?companyId=${encodeURIComponent(companyId)}`);
  if (!res.ok) throw new Error("Failed to fetch departments");
  const data = await res.json();
  return data.data || [];
}

export async function fetchWhiteCollarDesignations() {
  const res = await fetch("/api/v1/designations");
  if (!res.ok) throw new Error("Failed to fetch designations");
  const data = await res.json();
  return data.data || [];
}

export async function fetchBlueCollarPositionCategories() {
  const res = await fetch("/api/v1/position-categories");
  if (!res.ok) throw new Error("Failed to fetch position categories");
  const data = await res.json();
  return data.data || [];
}

export async function fetchAllowedOperationTypes(companyId: string, departmentId?: string) {
  if (!companyId) return [];
  let url = `/api/v1/manpower/operation-mappings/allowed?companyId=${encodeURIComponent(companyId)}`;
  if (departmentId) url += `&departmentId=${encodeURIComponent(departmentId)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch allowed operation types");
  const data = await res.json();
  return data.data || [];
}

export async function fetchHoldingCompany() {
  const res = await fetch("/api/v1/companies/holding-status");
  if (!res.ok) throw new Error("Failed to fetch holding company");
  const data = await res.json();
  return data.data;
}
