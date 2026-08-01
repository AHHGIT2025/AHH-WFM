// POST /api/v1/.../[entityType]/[id]/versions/[versionId]/lifecycle
// Handles: SUBMIT, APPROVE, REJECT, RETIRE, ACTIVATE, RESUBMIT
import { NextResponse } from "next/server";
import { prisma } from "@ahh-wfm/database";
import {
  checkApiAuth, getTable, parseBody, writeAudit, safeError,
  assertValidTransition, actionToState, LifecycleActionSchema,
  ENTITY_TYPE_MAP,
} from "@/lib/server/pc2a-shared";
import { CommercialCostService } from "@/lib/server/commercial-cost-service";

export async function POST(
  req: Request,
  { params }: { params: { entityType: string; id: string; versionId: string } }
) {
  try {
    const auth = await checkApiAuth(undefined, { requiredPermission: "settings.manage" });
    if (auth.error) return auth.error;
    const user = auth.session!.user as any;

    let tbl: ReturnType<typeof getTable>;
    try { tbl = getTable(params.entityType); } catch (e) { return safeError(e) as any; }

    const body = await req.json();
    const parsed = parseBody(LifecycleActionSchema, body);
    if ("error" in parsed) return parsed.error as any;

    const { action, comment } = parsed.data;

    const version = await (prisma as any)[tbl.version].findUnique({ where: { id: params.versionId } });
    if (!version || version.masterId !== params.id) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    // ── RESUBMIT: Creates a new Draft cloned from the rejected version ───────
    if (action === "RESUBMIT") {
      const typeKey = ENTITY_TYPE_MAP[params.entityType];
      const service = new CommercialCostService(user);
      const newVersion = await service.resubmitVersion(typeKey, params.versionId);

      await writeAudit(user.id, "RESUBMITTED", tbl.entityLabel, newVersion.id, {
        fromVersionId: params.versionId,
        versionNumber: newVersion.versionNumber,
        comment,
      });

      return NextResponse.json({ success: true, data: newVersion }, { status: 201 });
    }

    let newState: string;
    try { newState = actionToState(action, version.status); } catch (e) { return safeError(e) as any; }
    try { assertValidTransition(version.status, newState); } catch (e) { return safeError(e) as any; }

    // ── Maker/Checker for APPROVE ─────────────────────────────────────────────
    if (action === "APPROVE") {
      if (version.createdBy === user.id) {
        return NextResponse.json(
          { success: false, error: "Maker and Checker must differ. You cannot approve your own submission." },
          { status: 409 }
        );
      }
    }

    // ── ACTIVATE: concurrency-safe with FOR UPDATE ────────────────────────────
    if (action === "ACTIVATE") {
      try {
        const result = await prisma.$transaction(async (tx: any) => {
          // Ensure lock row exists
          await tx.$executeRaw`
            INSERT IGNORE INTO CostRateActivationLock (id, entityType, masterId, versionId, locked, updatedAt)
            VALUES (UUID(), ${tbl.entityLabel}, ${params.id}, ${params.versionId}, 0, NOW(3))
          `;
          // Acquire row-level lock
          await tx.$executeRaw`
            SELECT id FROM CostRateActivationLock
            WHERE entityType = ${tbl.entityLabel} AND masterId = ${params.id}
            FOR UPDATE
          `;

          // Recheck no overlapping ACTIVE in same window
          const actives = await (tx as any)[tbl.version].findMany({
            where: { masterId: params.id, status: "ACTIVE" },
          });
          for (const active of actives) {
            const aFrom = active.effectiveFrom.getTime();
            const aTo   = active.effectiveTo?.getTime() ?? Infinity;
            const nFrom = version.effectiveFrom.getTime();
            const nTo   = version.effectiveTo?.getTime() ?? Infinity;
            // half-open: [nFrom, nTo) overlaps [aFrom, aTo) when nFrom < aTo && aFrom < nTo
            if (nFrom < aTo && aFrom < nTo) {
              throw new Error("409: Overlapping ACTIVE version for this date range");
            }
          }

          const activated = await (tx as any)[tbl.version].update({
            where: { id: params.versionId },
            data: { status: "ACTIVE", approvedBy: user.id },
          });

          await tx.$executeRaw`
            UPDATE CostRateActivationLock SET locked = 0, updatedAt = NOW(3)
            WHERE entityType = ${tbl.entityLabel} AND masterId = ${params.id}
          `;

          return activated;
        });

        await writeAudit(user.id, "VERSION_ACTIVATED", tbl.entityLabel, params.versionId, {
          masterId: params.id, comment,
        });

        return NextResponse.json({ success: true, data: result });
      } catch (err: any) {
        const msg = err.message || "";
        if (msg.includes("Deadlock") || msg.includes("1213") || msg.includes("lock") || msg.includes("P2034")) {
          throw new Error("409: Concurrent activation request failed due to lock contention");
        }
        throw err;
      }
    }

    // ── Standard transitions ──────────────────────────────────────────────────
    const updateData: any = { status: newState };
    if (action === "APPROVE") updateData.approvedBy = user.id;

    const updated = await (prisma as any)[tbl.version].update({
      where: { id: params.versionId },
      data: updateData,
    });

    await writeAudit(user.id, `VERSION_${action}`, tbl.entityLabel, params.versionId, {
      from: version.status, to: newState, comment,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return safeError(err) as any;
  }
}
