import { prisma } from "@ahh-wfm/database";

export interface CommercialReminderWorkerResult {
  startedAt: Date;
  completedAt: Date;
  remindersProcessed: number;
  notificationsDispatched: number;
  failedCount: number;
}

export async function runCommercialReminderCycle(
  failureInjector?: (taskId: string) => void
): Promise<CommercialReminderWorkerResult> {
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
  let failedCount = 0;

  for (const task of dueTasks) {
    try {
      // Transaction guarantees: NOTIFICATION_CREATED + REMINDER_MARKED_SENT or NEITHER COMMITTED
      await prisma.$transaction(async (tx) => {
        // Atomic claim within transaction
        const updated = await tx.commercialTask.updateMany({
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

        if (updated.count === 0) {
          // Already claimed by concurrent worker cycle or task completed/cancelled
          return;
        }

        // Failure injection testing
        if (failureInjector) {
          failureInjector(task.id);
        }

        // Record UserActivityLog in-app notification event within same transaction
        await tx.userActivityLog.create({
          data: {
            userId: task.assignedToId || "system",
            action: "DISPATCH_COMMERCIAL_REMINDER",
            entityType: "CommercialTask",
            entityId: task.id,
            afterJson: JSON.stringify({
              taskId: task.id,
              title: task.title,
              reminderAt: task.reminderAt,
              dispatchedAt: new Date()
            })
          }
        });

        notificationsDispatched++;
      });
    } catch (err: any) {
      failedCount++;
      console.error(`[Commercial Reminder Worker] Transaction failed for task '${task.title}' (${task.id}): ${err.message}. Reminder remains retryable.`);
      // Rolled back transaction ensures task.reminderSent remains false in DB and is retried on subsequent scans!
    }
  }

  return {
    startedAt,
    completedAt: new Date(),
    remindersProcessed: dueTasks.length,
    notificationsDispatched,
    failedCount
  };
}

if (require.main === module) {
  console.log("[ahh-wfm-commercial-reminder-worker-dev] Starting Commercial Reminder Worker cycle...");
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
