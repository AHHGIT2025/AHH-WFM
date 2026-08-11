import { prisma } from "@ahh-wfm/database";

export interface CommercialReminderWorkerResult {
  startedAt: Date;
  completedAt: Date;
  remindersProcessed: number;
  notificationsDispatched: number;
}

export async function runCommercialReminderCycle(): Promise<CommercialReminderWorkerResult> {
  const startedAt = new Date();
  const now = new Date();

  // Find due tasks where status IN ('PENDING', 'IN_PROGRESS'), reminderAt <= NOW(), and reminderSent = false
  const dueTasks = await prisma.commercialTask.findMany({
    where: {
      status: { in: ["PENDING", "IN_PROGRESS"] },
      reminderSent: false,
      reminderAt: { lte: now }
    }
  });

  let notificationsDispatched = 0;

  for (const task of dueTasks) {
    // Atomic Claim: Ensure concurrent/repeat worker scans process each task exactly once
    const updated = await prisma.commercialTask.updateMany({
      where: {
        id: task.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        reminderSent: false,
        reminderAt: { lte: now }
      },
      data: {
        reminderSent: true
      }
    });

    if (updated.count === 1) {
      notificationsDispatched++;
      // Dispatch in-app Web notification / System Alert
      console.log(`[Commercial Reminder Worker] Dispatched reminder notification for Task '${task.title}' (ID: ${task.id}) assigned to ${task.assignedToName || task.assignedToId}`);
    }
  }

  return {
    startedAt,
    completedAt: new Date(),
    remindersProcessed: dueTasks.length,
    notificationsDispatched
  };
}

if (require.main === module) {
  console.log("[ahh-wfm-commercial-reminder-worker-dev] Starting Commercial Reminder Worker loop...");
  runCommercialReminderCycle()
    .then((res) => {
      console.log("[ahh-wfm-commercial-reminder-worker-dev] Cycle complete:", res);
      process.exit(0);
    })
    .catch((err) => {
      console.error("[ahh-wfm-commercial-reminder-worker-dev] Fatal error:", err);
      process.exit(1);
    });
}
