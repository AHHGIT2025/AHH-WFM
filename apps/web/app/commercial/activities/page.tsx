"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, Badge, Button, Input } from "@ahh-wfm/ui/src";
import CommercialActivityFeedPanel from "../../../components/commercial/CommercialActivityFeedPanel";

interface CommercialTaskItem {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  reminderAt: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  assignedToName: string | null;
  createdByName: string | null;
  createdAt: string;
}

export default function ActivitiesPage() {
  const [tasks, setTasks] = useState<CommercialTaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");

  // Create Task Modal
  const [showTaskModal, setShowTaskModal] = useState<boolean>(false);
  const [taskTitle, setTaskTitle] = useState<string>("");
  const [taskDescription, setTaskDescription] = useState<string>("");
  const [taskDueDate, setTaskDueDate] = useState<string>("");
  const [taskPriority, setTaskPriority] = useState<string>("MEDIUM");
  const [submittingTask, setSubmittingTask] = useState<boolean>(false);

  // Outlook Status
  const [outlookStatus, setOutlookStatus] = useState<any>(null);

  const fetchTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (priorityFilter !== "ALL") params.set("priority", priorityFilter);

      const res = await fetch(`/api/v1/commercial/tasks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
    } finally {
      setLoadingTasks(false);
    }
  }, [statusFilter, priorityFilter]);

  const fetchOutlookStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/commercial/outlook/status");
      if (res.ok) {
        const data = await res.json();
        setOutlookStatus(data);
      }
    } catch (e) {
      // Quiet fail
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchOutlookStatus();
  }, [fetchTasks, fetchOutlookStatus]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setSubmittingTask(true);
    try {
      const res = await fetch("/api/v1/commercial/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDescription.trim() || undefined,
          dueAt: taskDueDate || undefined,
          priority: taskPriority
        })
      });

      if (!res.ok) throw new Error("Failed to create task.");

      setTaskTitle("");
      setTaskDescription("");
      setTaskDueDate("");
      setShowTaskModal(false);
      fetchTasks();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleTaskStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/v1/commercial/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        fetchTasks();
      }
    } catch (err: any) {
      alert("Failed to update task status.");
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return "error";
      case "HIGH":
        return "warning";
      case "MEDIUM":
        return "info";
      default:
        return "neutral";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "success";
      case "IN_PROGRESS":
        return "info";
      case "CANCELLED":
        return "neutral";
      default:
        return "warning";
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl border border-border-subtle shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-on-surface flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-3xl">history</span>
            Commercial Activities & Task Scheduler
          </h1>
          <p className="mt-1 text-xs text-on-surface-variant max-w-2xl">
            Track client interaction logs (Emails, Calls, Meetings, Notes), manage follow-up tasks & reminders, and view unified chronological activity feeds across all commercial workspaces.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => setShowTaskModal(true)} className="flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">add_task</span>
            Schedule New Task
          </Button>
        </div>
      </div>

      {/* Outlook Integration Status Card */}
      <Card className="p-4 bg-surface-container-low border border-border-subtle rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-2xl">mail</span>
            <div>
              <h4 className="text-xs font-bold text-on-surface flex items-center gap-2">
                Outlook Integration & Notification Channels
                <Badge variant={outlookStatus?.configured ? "success" : "neutral"}>
                  {outlookStatus?.status || "OUTLOOK_MANUAL_LINK_COMPLETE"}
                </Badge>
              </h4>
              <p className="text-[11px] text-on-surface-variant">
                {outlookStatus?.message || "Manual Outlook email and meeting linkage enabled. Microsoft Graph live sync pending Entra ID configuration."}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Grid: Left Timeline Feed, Right Task Scheduler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Reusable Chronological Feed Panel */}
        <div className="lg:col-span-2 space-y-6">
          <CommercialActivityFeedPanel title="Commercial Master Timeline Feed" />
        </div>

        {/* Right Column: Assigned Tasks & Follow-Up Reminders */}
        <div className="space-y-6">
          <Card className="p-6 bg-surface-container-lowest border border-border-subtle shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-subtle">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">task_alt</span>
                Assigned Follow-Up Tasks
              </h3>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs rounded-lg border border-border-subtle bg-surface px-2 py-1 text-on-surface"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            {loadingTasks ? (
              <div className="text-center py-6">
                <span className="material-symbols-outlined animate-spin text-xl text-primary">sync</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-6 bg-surface-container-low rounded-lg border border-dashed border-border-subtle text-xs text-on-surface-variant">
                No active follow-up tasks scheduled.
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {tasks.map((task) => (
                  <div key={task.id} className="p-3 bg-surface rounded-xl border border-border-subtle space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={getPriorityBadgeVariant(task.priority) as any}>
                        {task.priority}
                      </Badge>
                      <Badge variant={getStatusBadgeVariant(task.status) as any}>
                        {task.status}
                      </Badge>
                    </div>

                    <h4 className="text-xs font-bold text-on-surface">{task.title}</h4>

                    {task.description && (
                      <p className="text-[11px] text-on-surface-variant line-clamp-2">{task.description}</p>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-on-surface-variant pt-2 border-t border-border-subtle">
                      <span>Due: {task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "No due date"}</span>
                      {task.status !== "COMPLETED" && (
                        <button
                          onClick={() => handleTaskStatusChange(task.id, "COMPLETED")}
                          className="text-primary font-bold hover:underline"
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-md w-full p-6 shadow-xl border border-border-subtle">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">add_task</span>
                Schedule Follow-Up Task
              </h3>
              <button onClick={() => setShowTaskModal(false)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-on-surface mb-1 font-bold">Task Title *</label>
                <Input
                  value={taskTitle}
                  onChange={(e: any) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Follow up on contract addendum signature"
                  required
                />
              </div>

              <div>
                <label className="block text-on-surface mb-1 font-bold">Description</label>
                <textarea
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-border-subtle bg-surface p-2 text-on-surface focus:outline-none focus:border-primary"
                  placeholder="Task details and action items..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-on-surface mb-1 font-bold">Due Date</label>
                  <Input
                    type="date"
                    value={taskDueDate}
                    onChange={(e: any) => setTaskDueDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-on-surface mb-1 font-bold">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full rounded-lg border border-border-subtle bg-surface p-2 text-on-surface"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
                <Button variant="secondary" onClick={() => setShowTaskModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={submittingTask || !taskTitle.trim()}>
                  {submittingTask ? "Scheduling..." : "Create Task"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
