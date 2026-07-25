/**
 * Roster Display Utilities
 * Standardized presentation helpers for deployment calendar and roster planning components.
 */

/**
 * Resolves employee designation / position for display across roster planning components.
 * Precedence:
 * 1. employee.designation.name (trimmed)
 * 2. slot.snapshotPosition or slot.position (trimmed)
 * 3. "Not specified"
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
