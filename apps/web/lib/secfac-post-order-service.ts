import { prisma } from "@ahh-wfm/database";
import { createSecfacFieldExecutionAudit } from "./secfac-audit-helpers";

export interface CreatePostOrderParams {
  familyId?: string;
  postOrderCode?: string;
  operationType?: string;
  companyId: string;
  siteId: string;
  checkpointId?: string;
  title: string;
  category?: string;
  content: string;
  requiresAcknowledgement?: boolean;
  effectiveFrom?: string | Date;
  createdById: string;
}

export async function createPostOrder(params: CreatePostOrderParams) {
  const opType = params.operationType || "SECURITY_GUARDING";
  const familyId = params.familyId || `POFAM-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Find latest version number in this family
  const existingVersions = await prisma.secfacPostOrder.findMany({
    where: { familyId, companyId: params.companyId },
    orderBy: { version: "desc" },
    take: 1
  });

  const nextVersion = existingVersions.length > 0 ? existingVersions[0].version + 1 : 1;

  const postOrder = await prisma.secfacPostOrder.create({
    data: {
      familyId,
      postOrderCode: params.postOrderCode || `PO-${params.companyId.slice(-4)}-${Date.now().toString().slice(-6)}`,
      operationType: opType,
      companyId: params.companyId,
      siteId: params.siteId,
      checkpointId: params.checkpointId || null,
      title: params.title,
      category: params.category || "GENERAL_POST_ORDER",
      content: params.content,
      version: nextVersion,
      effectiveFrom: params.effectiveFrom ? new Date(params.effectiveFrom) : new Date(),
      status: "DRAFT",
      requiresAcknowledgement: params.requiresAcknowledgement !== false,
      createdById: params.createdById
    }
  });

  await createSecfacFieldExecutionAudit({
    operationType: opType,
    employeeId: params.createdById,
    postOrderId: postOrder.id,
    actionType: "POST_ORDER_CREATED",
    actionSource: "WEB_APP",
    resultStatus: "SUCCESS",
    resultMessage: `Post Order draft v${nextVersion} created for family ${familyId}`
  }).catch(() => {});

  return postOrder;
}

export async function publishPostOrder(id: string, publishedById: string) {
  const target = await prisma.secfacPostOrder.findUnique({
    where: { id }
  });

  if (!target) {
    throw new Error(`Post Order '${id}' not found.`);
  }

  const now = new Date();

  // Atomically mark prior PUBLISHED version of SAME family as SUPERSEDED and set new version as PUBLISHED
  const result = await prisma.$transaction(async (tx) => {
    // Supersede previous published versions in the exact SAME familyId only
    await tx.secfacPostOrder.updateMany({
      where: {
        familyId: target.familyId,
        companyId: target.companyId,
        status: "PUBLISHED",
        id: { not: id }
      },
      data: {
        status: "SUPERSEDED",
        effectiveTo: now
      }
    });

    const updated = await tx.secfacPostOrder.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedById,
        publishedAt: now,
        effectiveFrom: now
      }
    });

    return updated;
  });

  await createSecfacFieldExecutionAudit({
    operationType: target.operationType,
    employeeId: publishedById,
    postOrderId: target.id,
    actionType: "POST_ORDER_PUBLISHED",
    actionSource: "WEB_APP",
    resultStatus: "SUCCESS",
    resultMessage: `Post Order v${target.version} published (family ${target.familyId})`
  }).catch(() => {});

  return result;
}

export async function retirePostOrder(id: string, retiredById: string) {
  const target = await prisma.secfacPostOrder.findUnique({ where: { id } });
  if (!target) throw new Error(`Post Order '${id}' not found.`);

  const updated = await prisma.secfacPostOrder.update({
    where: { id },
    data: {
      status: "RETIRED",
      effectiveTo: new Date()
    }
  });

  await createSecfacFieldExecutionAudit({
    operationType: target.operationType,
    employeeId: retiredById,
    postOrderId: target.id,
    actionType: "POST_ORDER_RETIRED",
    actionSource: "WEB_APP",
    resultStatus: "SUCCESS",
    resultMessage: `Post Order v${target.version} retired`
  }).catch(() => {});

  return updated;
}

export async function getGuardActivePostOrders(params: {
  employeeId: string;
  companyId: string;
  siteId: string;
  checkpointId?: string;
}) {
  const now = new Date();

  // Retrieve published post orders for the guard's site/post shift context
  const activeOrders = await prisma.secfacPostOrder.findMany({
    where: {
      companyId: params.companyId,
      siteId: params.siteId,
      operationType: "SECURITY_GUARDING",
      status: "PUBLISHED",
      effectiveFrom: { lte: now },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: now } }
      ],
      ...(params.checkpointId ? { OR: [{ checkpointId: null }, { checkpointId: params.checkpointId }] } : {})
    },
    orderBy: { version: "desc" }
  });

  // Deduplicate by familyId to get effective published version per instruction family
  const familyMap = new Map<string, typeof activeOrders[0]>();
  for (const order of activeOrders) {
    if (!familyMap.has(order.familyId)) {
      familyMap.set(order.familyId, order);
    }
  }

  const effectivePostOrders = Array.from(familyMap.values());
  const postOrderIds = effectivePostOrders.map(p => p.id);

  // Query existing acknowledgements for this guard
  const acks = await prisma.secfacPostOrderAcknowledgement.findMany({
    where: {
      employeeId: params.employeeId,
      postOrderId: { in: postOrderIds }
    }
  });

  const ackedSet = new Set(acks.map(a => a.postOrderId));

  return effectivePostOrders.map(order => ({
    ...order,
    isAcknowledged: ackedSet.has(order.id)
  }));
}

export async function acknowledgePostOrder(params: {
  postOrderId: string;
  employeeId: string;
  deploymentId?: string;
  acknowledgementMethod?: string;
  idempotencyKey?: string;
}) {
  const postOrder = await prisma.secfacPostOrder.findUnique({
    where: { id: params.postOrderId }
  });

  if (!postOrder) {
    throw new Error(`Post Order '${params.postOrderId}' not found.`);
  }

  if (postOrder.status !== "PUBLISHED") {
    throw new Error(`Cannot acknowledge Post Order with status '${postOrder.status}'. Only PUBLISHED post orders can be acknowledged.`);
  }

  const idempotencyKey = params.idempotencyKey || `ACK-${params.postOrderId}-${params.employeeId}-${Date.now()}`;

  // Enforce idempotency & unique constraint [postOrderId, employeeId]
  const ack = await prisma.secfacPostOrderAcknowledgement.upsert({
    where: {
      postOrderId_employeeId: {
        postOrderId: params.postOrderId,
        employeeId: params.employeeId
      }
    },
    update: {
      acknowledgedAt: new Date()
    },
    create: {
      postOrderId: params.postOrderId,
      employeeId: params.employeeId,
      deploymentId: params.deploymentId || null,
      acknowledgementMethod: params.acknowledgementMethod || "MOBILE_APP",
      idempotencyKey,
      acknowledgedAt: new Date()
    }
  });

  await createSecfacFieldExecutionAudit({
    operationType: postOrder.operationType,
    employeeId: params.employeeId,
    postOrderId: postOrder.id,
    actionType: "POST_ORDER_ACKNOWLEDGED",
    actionSource: params.acknowledgementMethod || "MOBILE_APP",
    resultStatus: "SUCCESS",
    resultMessage: `Guard ${params.employeeId} acknowledged Post Order v${postOrder.version} (family ${postOrder.familyId})`
  }).catch(() => {});

  return ack;
}
