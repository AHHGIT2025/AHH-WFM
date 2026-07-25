/**
 * Roster Display Utilities
 * Standardized presentation helpers for deployment calendar and roster planning components.
 */

// ---------------------------------------------------------------------------
// Trade/Position source enum
// ---------------------------------------------------------------------------

/**
 * Indicates which field was used to resolve the employee's displayed Trade/Position.
 */
export type TradePositionSource =
  | "POSITION_CATEGORY"  // positionCategory.name (BLUE_COLLAR authoritative)
  | "DESIGNATION"        // designation.name (WHITE_COLLAR authoritative)
  | "NOT_SPECIFIED";     // Neither field was set

// ---------------------------------------------------------------------------
// Authoritative Trade/Position resolver (Workforce Directory aligned)
// ---------------------------------------------------------------------------

/**
 * Resolves the authoritative employee Trade/Position for live operational display.
 *
 * Business Rules:
 *   BLUE_COLLAR → positionCategory.name → "Not specified"
 *   WHITE_COLLAR → designation.name → "Not specified"
 *   Unknown category → positionCategory.name → designation.name → "Not specified"
 *
 * IMPORTANT:
 *   - Does NOT accept slot.snapshotPosition as an employee Trade/Position fallback.
 *   - snapshotPosition is an immutable historical slot field, not employee master data.
 *   - Incomplete master data (missing positionCategory) must remain visible as
 *     "Not specified" so operators can identify and correct it.
 */
export function resolveEmployeeTradePosition(employee?: any): string {
  if (!employee) return "Not specified";

  const category = (employee.employeeCategory || "").toUpperCase();

  if (category === "BLUE_COLLAR") {
    const posName = employee.positionCategory?.name;
    if (typeof posName === "string" && posName.trim().length > 0) {
      return posName.trim();
    }
    return "Not specified";
  }

  if (category === "WHITE_COLLAR") {
    const desigName = employee.designation?.name;
    if (typeof desigName === "string" && desigName.trim().length > 0) {
      return desigName.trim();
    }
    return "Not specified";
  }

  // Unknown or absent category — check positionCategory first, then designation
  const posName = employee.positionCategory?.name;
  if (typeof posName === "string" && posName.trim().length > 0) {
    return posName.trim();
  }
  const desigName = employee.designation?.name;
  if (typeof desigName === "string" && desigName.trim().length > 0) {
    return desigName.trim();
  }
  return "Not specified";
}

/**
 * Returns the source field used for Trade/Position resolution.
 * Useful for tests and audit display (e.g. showing "(from Designation)" badge).
 */
export function resolveEmployeeTradePositionSource(employee?: any): TradePositionSource {
  if (!employee) return "NOT_SPECIFIED";

  const category = (employee.employeeCategory || "").toUpperCase();

  if (category === "BLUE_COLLAR") {
    const posName = employee.positionCategory?.name;
    if (typeof posName === "string" && posName.trim().length > 0) return "POSITION_CATEGORY";
    return "NOT_SPECIFIED";
  }

  if (category === "WHITE_COLLAR") {
    const desigName = employee.designation?.name;
    if (typeof desigName === "string" && desigName.trim().length > 0) return "DESIGNATION";
    return "NOT_SPECIFIED";
  }

  // Unknown category
  const posName = employee.positionCategory?.name;
  if (typeof posName === "string" && posName.trim().length > 0) return "POSITION_CATEGORY";
  const desigName = employee.designation?.name;
  if (typeof desigName === "string" && desigName.trim().length > 0) return "DESIGNATION";
  return "NOT_SPECIFIED";
}

// ---------------------------------------------------------------------------
// Historical publication helpers (slot-derived — DO NOT use for live employee data)
// ---------------------------------------------------------------------------

/**
 * Resolves the historical slot position captured at publication time.
 * Use ONLY for publication history and archived roster views.
 * Never use this to display a live employee's current Trade/Position.
 */
export function resolveHistoricalSlotPosition(slot?: any): string {
  const snapshotPos = slot?.snapshotPosition || slot?.position;
  if (typeof snapshotPos === "string" && snapshotPos.trim().length > 0) {
    return snapshotPos.trim();
  }
  return "Not specified";
}

// ---------------------------------------------------------------------------
// Legacy resolver — deprecated, kept for backwards compatibility
// ---------------------------------------------------------------------------

/**
 * @deprecated Use resolveEmployeeTradePosition() for live employee Trade/Position display.
 * This function reads designation.name first (incorrect for BLUE_COLLAR employees)
 * and falls back to snapshotPosition (which is historical slot data, not employee master data).
 *
 * Retained only to avoid breaking any non-manpower HR callers during migration.
 * Migrate all manpower planning callers to resolveEmployeeTradePosition().
 */
export function resolveRosterDesignation(employee?: any, slot?: any): string {
  const empDesignation = employee?.designation?.name;
  if (typeof empDesignation === "string" && empDesignation.trim().length > 0) {
    return empDesignation.trim();
  }

  const snapshotPos = slot?.snapshotPosition || slot?.position;
  if (typeof snapshotPos === "string" && snapshotPos.trim().length > 0) {
    return snapshotPos.trim();
  }

  return "Not specified";
}

// ---------------------------------------------------------------------------
// Shift / date helpers (unchanged)
// ---------------------------------------------------------------------------

/**
 * Resolves shift name safely.
 */
export function resolveRosterShiftName(slot?: any): string {
  const shiftName = slot?.snapshotShiftName || slot?.shiftName;
  if (typeof shiftName === "string" && shiftName.trim().length > 0) {
    return shiftName.trim();
  }
  return "Unspecified Shift";
}

/**
 * Resolves shift times string safely.
 */
export function resolveRosterShiftTimes(slot?: any): string {
  const start = slot?.snapshotStartTime || slot?.startTime;
  const end = slot?.snapshotEndTime || slot?.endTime;
  if (start && end) {
    return `${start} - ${end}`;
  }
  return "";
}

/**
 * Resolves formatted business date safely (YYYY-MM-DD).
 */
export function resolveRosterDateStr(businessDate?: any): string {
  if (!businessDate) return "N/A";
  try {
    const d = new Date(businessDate);
    if (isNaN(d.getTime())) return "N/A";
    return d.toISOString().split("T")[0];
  } catch (e) {
    return "N/A";
  }
}
