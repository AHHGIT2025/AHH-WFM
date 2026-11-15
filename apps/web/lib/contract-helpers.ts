export function getEffectiveContractManpower(contract: any, asOfDate?: Date | string | null) {
  if (!contract) {
    return {
      effectiveManpower: [],
      effectiveReliever: [],
      effectiveShift: []
    };
  }

  const evalDate = asOfDate ? new Date(asOfDate) : null;

  // 1. Gather original manpower requirements
  const originalManpower = contract.manpowerRequirements || [];
  const manpowerMap: Record<string, {
    requirementId: string;
    position: string;
    originalQty: number;
    addendumQty: number;
    quantity: number;
    unitPrice: number;
    billingFrequency: string;
    isFoc: boolean;
    breakdown: { type: string; qty: number; detail?: string }[];
  }> = {};

  for (const req of originalManpower) {
    const pos = req.position || req.designation || "Unknown";
    if (!manpowerMap[pos]) {
      manpowerMap[pos] = {
        requirementId: req.id,
        position: pos,
        originalQty: 0,
        addendumQty: 0,
        quantity: 0,
        unitPrice: req.unitPrice || 0,
        billingFrequency: req.billingFrequency || "MONTHLY",
        isFoc: req.isFoc || false,
        breakdown: []
      };
    }
    manpowerMap[pos].originalQty += req.quantity || 0;
    manpowerMap[pos].breakdown.push({
      type: "Original",
      qty: req.quantity || 0,
      detail: req.remarks || ""
    });
  }

  // 2. Fetch approved active addendums ONLY (DEF-083: DRAFT, PENDING, REJECTED, and CANCELLED have zero effect)
  const activeAddendums = (contract.addendums || []).filter((a: any) => {
    const isApprovedStatus = a.status === "APPROVED" || a.status === "ACTIVE";
    if (!isApprovedStatus) return false;

    // If an evaluation date is specified, enforce effective date window
    if (evalDate) {
      if (a.effectiveFrom && new Date(a.effectiveFrom) > evalDate) return false;
      if (a.effectiveTo && new Date(a.effectiveTo) < evalDate) return false;
    }

    return true;
  });

  // Apply addendum changes for MANPOWER
  for (const addendum of activeAddendums) {
    const lineItems = addendum.lineItems || [];
    for (const li of lineItems) {
      if (li.itemType !== "MANPOWER") continue;
      const pos = li.itemName || li.label || "Unknown";
      const change = li.changeType || li.action || "ADD";
      const qty = li.quantity || 0;

      if (!manpowerMap[pos]) {
        manpowerMap[pos] = {
          requirementId: li.id, // Use addendum line item ID if new position
          position: pos,
          originalQty: 0,
          addendumQty: 0,
          quantity: 0,
          unitPrice: li.unitPrice || 0,
          billingFrequency: li.billingFrequency || "MONTHLY",
          isFoc: li.isFoc || false,
          breakdown: []
        };
      }

      const item = manpowerMap[pos];
      if (change === "ADD") {
        item.addendumQty += qty;
        item.breakdown.push({
          type: `Addendum (${addendum.addendumNumber})`,
          qty: qty,
          detail: `Added via ${addendum.title}`
        });
      } else if (change === "REMOVE" || change === "DELETE") {
        item.addendumQty -= qty;
        item.breakdown.push({
          type: `Addendum (${addendum.addendumNumber})`,
          qty: -qty,
          detail: `Removed via ${addendum.title}`
        });
      } else if (change === "UPDATE" || change === "MODIFY") {
        const currentQtyBeforeThis = item.originalQty + item.addendumQty;
        const delta = qty - currentQtyBeforeThis;
        item.addendumQty += delta;
        item.breakdown.push({
          type: `Addendum (${addendum.addendumNumber})`,
          qty: delta,
          detail: `Updated to total ${qty} via ${addendum.title}`
        });
      }
    }
  }

  // Calculate final totals
  const effectiveManpower = Object.values(manpowerMap).map(item => {
    item.quantity = Math.max(0, item.originalQty + item.addendumQty);
    return item;
  });

  // --- Process Reliever Requirements ---
  const originalRelievers = contract.relieverRequirements || [];
  const relieverMap: Record<string, {
    requirementId: string;
    position: string;
    originalQty: number;
    addendumQty: number;
    quantity: number;
    sourcePreference: string;
    breakdown: { type: string; qty: number; detail?: string }[];
  }> = {};

  for (const req of originalRelievers) {
    const pos = req.position || req.designation || "Unknown";
    if (!relieverMap[pos]) {
      relieverMap[pos] = {
        requirementId: req.id,
        position: pos,
        originalQty: 0,
        addendumQty: 0,
        quantity: 0,
        sourcePreference: req.sourcePreference || "GENERAL_POOL",
        breakdown: []
      };
    }
    relieverMap[pos].originalQty += req.quantity || 0;
    relieverMap[pos].breakdown.push({
      type: "Original",
      qty: req.quantity || 0,
      detail: req.remarks || ""
    });
  }

  for (const addendum of activeAddendums) {
    const lineItems = addendum.lineItems || [];
    for (const li of lineItems) {
      if (li.itemType !== "RELIEVER") continue;
      const pos = li.itemName || li.label || "Unknown";
      const change = li.changeType || li.action || "ADD";
      const qty = li.quantity || 0;

      if (!relieverMap[pos]) {
        relieverMap[pos] = {
          requirementId: li.id,
          position: pos,
          originalQty: 0,
          addendumQty: 0,
          quantity: 0,
          sourcePreference: li.remarks || "GENERAL_POOL",
          breakdown: []
        };
      }

      const item = relieverMap[pos];
      if (change === "ADD") {
        item.addendumQty += qty;
        item.breakdown.push({
          type: `Addendum (${addendum.addendumNumber})`,
          qty: qty,
          detail: `Added via ${addendum.title}`
        });
      } else if (change === "REMOVE" || change === "DELETE") {
        item.addendumQty -= qty;
        item.breakdown.push({
          type: `Addendum (${addendum.addendumNumber})`,
          qty: -qty,
          detail: `Removed via ${addendum.title}`
        });
      } else if (change === "UPDATE" || change === "MODIFY") {
        const currentQtyBeforeThis = item.originalQty + item.addendumQty;
        const delta = qty - currentQtyBeforeThis;
        item.addendumQty += delta;
        item.breakdown.push({
          type: `Addendum (${addendum.addendumNumber})`,
          qty: delta,
          detail: `Updated to total ${qty} via ${addendum.title}`
        });
      }
    }
  }

  const effectiveReliever = Object.values(relieverMap).map(item => {
    item.quantity = Math.max(0, item.originalQty + item.addendumQty);
    return item;
  });

  // --- Process Shift Requirements ---
  const originalShifts = contract.shiftRequirements || [];
  const shiftMap: Record<string, {
    requirementId: string;
    shiftName: string;
    startTime: string;
    endTime: string;
    postsCovered: number;
    daysPattern: string;
    originalPosts: number;
    addendumPosts: number;
    quantity: number; // total posts
    breakdown: { type: string; qty: number; detail?: string }[];
  }> = {};

  for (const req of originalShifts) {
    const name = req.shiftName;
    if (!shiftMap[name]) {
      shiftMap[name] = {
        requirementId: req.id,
        shiftName: name,
        startTime: req.startTime,
        endTime: req.endTime,
        postsCovered: req.postsCovered || 0,
        daysPattern: req.daysPattern || "Daily",
        originalPosts: 0,
        addendumPosts: 0,
        quantity: 0,
        breakdown: []
      };
    }
    shiftMap[name].originalPosts += req.postsCovered || 0;
    shiftMap[name].breakdown.push({
      type: "Original",
      qty: req.postsCovered || 0,
      detail: req.remarks || ""
    });
  }

  for (const addendum of activeAddendums) {
    const lineItems = addendum.lineItems || [];
    for (const li of lineItems) {
      if (li.itemType !== "SHIFT") continue;
      const name = li.itemName || li.label || "Unknown";
      const change = li.changeType || li.action || "ADD";
      const qty = li.quantity || 0;

      if (!shiftMap[name]) {
        shiftMap[name] = {
          requirementId: li.id,
          shiftName: name,
          startTime: "00:00",
          endTime: "00:00",
          postsCovered: qty,
          daysPattern: "Daily",
          originalPosts: 0,
          addendumPosts: 0,
          quantity: 0,
          breakdown: []
        };
      }

      const item = shiftMap[name];
      if (change === "ADD") {
        item.addendumPosts += qty;
        item.breakdown.push({
          type: `Addendum (${addendum.addendumNumber})`,
          qty: qty,
          detail: `Added via ${addendum.title}`
        });
      } else if (change === "REMOVE" || change === "DELETE") {
        item.addendumPosts -= qty;
        item.breakdown.push({
          type: `Addendum (${addendum.addendumNumber})`,
          qty: -qty,
          detail: `Removed via ${addendum.title}`
        });
      } else if (change === "UPDATE" || change === "MODIFY") {
        const currentQtyBeforeThis = item.originalPosts + item.addendumPosts;
        const delta = qty - currentQtyBeforeThis;
        item.addendumPosts += delta;
        item.breakdown.push({
          type: `Addendum (${addendum.addendumNumber})`,
          qty: delta,
          detail: `Updated to total ${qty} via ${addendum.title}`
        });
      }
    }
  }

  const effectiveShift = Object.values(shiftMap).map(item => {
    item.quantity = Math.max(0, item.originalPosts + item.addendumPosts);
    item.postsCovered = item.quantity;
    return item;
  });

  return {
    effectiveManpower,
    effectiveReliever,
    effectiveShift
  };
}

/**
 * Authoritative Reliever Eligibility Filter (Reused across CCC-2 and CCC-4)
 * Evaluates active employment, OFF_DUTY status, and reliever/standby eligibility flags.
 */
export function getRelieverEligibilityWhere(options?: {
  companyId?: string;
  operationType?: string;
}) {
  const where: any = {
    isActive: true,
    employmentStatus: "ACTIVE",
    dutyStatus: "OFF_DUTY",
    OR: [{ isRelieverEligible: true }, { isStandbyEligible: true }]
  };

  if (options?.companyId) where.companyId = options.companyId;
  if (options?.operationType && options.operationType !== "ALL") {
    where.operationType = options.operationType;
  }

  return where;
}

/**
 * Dynamic Contract Expiry & Operational Validity Check
 * Enforces date validity even if stored status is ACTIVE.
 */
export function isContractDateValid(contract: any, targetDate?: Date | string): boolean {
  if (!contract || !contract.endDate) return true;
  const targetObj = targetDate ? new Date(targetDate) : new Date();
  const endDate = new Date(contract.endDate);
  return targetObj.getTime() <= endDate.getTime();
}

/**
 * Calculates pro-rata calendar-month financial impact for an addendum period.
 * Walks each calendar month overlapping [effectiveFrom, effectiveEnd] inclusive
 * and sums overlapDays / daysInMonth so non-whole-month periods are prorated accurately.
 */
export function calculateAddendumFinancialImpact(
  lineItems: any[],
  effectiveFrom: Date | string,
  effectiveEnd: Date | string,
  originalRequirements: any[] = []
): { monthlyNet: number; effectiveMonths: number; fullTermNet: number } {
  let monthlyNet = 0;
  for (const li of lineItems || []) {
    if (li?.isFoc === true || li?.isFoc === "Yes") continue;
    const qty = Number(li?.quantity ?? li?.newQuantity ?? 0) || 0;
    const rate = Number(li?.unitRate ?? li?.unitPrice ?? 0) || 0;
    const action = li?.action || li?.changeType || "ADD";
    if (action === "REMOVE") {
      monthlyNet -= qty * rate;
    } else if (action === "MODIFY" || action === "UPDATE") {
      const orig = (originalRequirements || []).find(
        (r: any) =>
          (li?.categoryId && r?.categoryId === li.categoryId) ||
          (li?.designationId && r?.designationId === li.designationId) ||
          (li?.roleTitle && r?.roleTitle === li.roleTitle) ||
          ((r?.position || r?.designation) &&
            (r?.position || r?.designation) === (li?.label || li?.itemName))
      );
      const oldQty = orig ? Number(orig.quantity ?? 0) || 0 : Number(li?.previousQuantity ?? 0) || 0;
      const oldRate = orig ? Number(orig.unitRate ?? orig.unitPrice ?? rate) || 0 : rate;
      monthlyNet += qty * rate - oldQty * oldRate;
    } else {
      monthlyNet += qty * rate;
    }
  }

  let effectiveMonths = 0;
  if (effectiveFrom && effectiveEnd) {
    const s = new Date(effectiveFrom);
    const e = new Date(effectiveEnd);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime())) {
      const startDay = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
      const endDay = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()));
      if (endDay.getTime() >= startDay.getTime()) {
        let curY = startDay.getUTCFullYear();
        let curM = startDay.getUTCMonth();
        const endY = endDay.getUTCFullYear();
        const endM = endDay.getUTCMonth();
        const msPerDay = 86400000;

        while (curY < endY || (curY === endY && curM <= endM)) {
          const daysInMonth = new Date(Date.UTC(curY, curM + 1, 0)).getUTCDate();
          const mStart = new Date(Date.UTC(curY, curM, 1));
          const mEnd = new Date(Date.UTC(curY, curM, daysInMonth));
          const overlapStart = startDay > mStart ? startDay : mStart;
          const overlapEnd = endDay < mEnd ? endDay : mEnd;
          if (overlapEnd >= overlapStart) {
            const overlapDays = Math.floor((overlapEnd.getTime() - overlapStart.getTime()) / msPerDay) + 1;
            effectiveMonths += overlapDays / daysInMonth;
          }
          curM += 1;
          if (curM > 11) {
            curM = 0;
            curY += 1;
          }
        }
      }
    }
  }

  effectiveMonths = Math.round(effectiveMonths * 10000) / 10000;
  monthlyNet = Math.round(monthlyNet * 100) / 100;
  const fullTermNet = Math.round(monthlyNet * effectiveMonths * 100) / 100;
  return { monthlyNet, effectiveMonths, fullTermNet };
}





