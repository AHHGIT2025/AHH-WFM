"use client";

import React, { useState, useEffect } from "react";
import { Employee, AttendanceRecord, LeaveRequest } from "@ahh-wfm/types";
import { Card, Badge, Button } from "@ahh-wfm/ui/src";

export default function DashboardPage() {
  const [data, setData] = useState<{
    employees: Employee[];
    attendance: AttendanceRecord[];
    leaves: LeaveRequest[];
  }>({ employees: [], attendance: [], leaves: [] });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [latency, setLatency] = useState(129);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Poll for database changes
  const fetchDb = async () => {
    try {
      const [empRes, attRes, lvRes] = await Promise.all([
        fetch("/api/v1/employees"),
        fetch("/api/v1/attendance"),
        fetch("/api/v1/leaves")
      ]);
      if (empRes.ok && attRes.ok && lvRes.ok) {
        const [employees, attendance, leaves] = await Promise.all([
          empRes.json(),
          attRes.json(),
          lvRes.json()
        ]);
        setData({ employees, attendance, leaves });
      }
    } catch (e) {
      console.error("Failed to fetch WFM DB", e);
    }
  };

  useEffect(() => {
    fetchDb();
    const interval = setInterval(fetchDb, 3000);
    return () => clearInterval(interval);
  }, []);

  // Simulated latency micro-interaction
  useEffect(() => {
    const latencyInterval = setInterval(() => {
      setLatency(Math.floor(Math.random() * (150 - 110 + 1) + 110));
    }, 5000);
    return () => clearInterval(latencyInterval);
  }, []);

  // Handle leave approval
  const handleLeaveAction = async (id: string, status: "Approved" | "Rejected") => {
    try {
      const res = await fetch(`/api/v1/leaves/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchDb();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Handle manual sync action
  const handleSyncWorker = async (employeeId: string) => {
    setSyncingId(employeeId);
    try {
      await fetch("/api/v1/sap/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "Data Push",
          subject: `Sync_${employeeId}`,
          status: "Success",
          details: `Manually synchronized employee record for ID ${employeeId}`
        })
      });
      setTimeout(() => {
        setSyncingId(null);
      }, 1000);
    } catch (e) {
      setSyncingId(null);
    }
  };

  // Filters & Search
  const filteredEmployees = data.employees.filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) || emp.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || emp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeOperatives = data.employees.filter(e => e.status === "On Duty" || e.status === "On Break").length;
  const pendingRequests = data.leaves.filter(l => l.status === "Pending Approval").length;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-primary">Command Center Dashboard</h1>
        <p className="text-sm text-on-surface-variant">Real-time geo-attendance and ERP sync controls</p>
      </div>

      {/* Hero Statistics Bento Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="flex flex-col justify-between border-l-4 border-l-secondary">
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Sync Latency</p>
            <h2 className="text-3xl font-extrabold text-primary mt-1">{latency}ms</h2>
          </div>
          <div className="flex items-center gap-2 mt-4 text-status-success font-semibold text-xs">
            <span className="w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
            <span>Real-time Healthy</span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between border-l-4 border-l-secondary-container">
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Field Operatives</p>
            <h2 className="text-3xl font-extrabold text-primary mt-1">{activeOperatives}</h2>
          </div>
          <p className="text-xs text-on-surface-variant font-semibold mt-4">
            Total registered: {data.employees.length}
          </p>
        </Card>

        <Card className="flex flex-col justify-between border-l-4 border-l-status-warning">
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Pending Requisitions</p>
            <h2 className={`text-3xl font-extrabold mt-1 ${pendingRequests > 0 ? "text-status-warning" : "text-primary"}`}>
              {pendingRequests}
            </h2>
          </div>
          <p className="text-xs text-on-surface-variant font-semibold mt-4">Requires supervisor action</p>
        </Card>

        <Card className="flex flex-col justify-between border-l-4 border-l-status-success">
          <div>
            <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">SAP ERP Bridge</p>
            <h2 className="text-3xl font-extrabold text-primary mt-1">Online</h2>
          </div>
          <div className="flex items-center gap-1.5 mt-4 text-on-surface-variant text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px] text-status-success animate-spin">sync</span>
            <span>Auto-Mirror Active</span>
          </div>
        </Card>
      </section>

      {/* Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Topographic Map Visualizer */}
        <Card className="lg:col-span-2 overflow-hidden relative group p-0 min-h-[400px] flex flex-col">
          <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md p-3 rounded-lg border border-border-subtle shadow-md">
            <h3 className="text-xs font-bold text-primary">Live Regional Activity (Doha Grid)</h3>
            <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold text-on-surface-variant">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-status-success shadow-[0_0_8px_#1E8E3E]"></span>
                <span>Active Duty</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-status-warning shadow-[0_0_8px_#F9AB00]"></span>
                <span>On Break</span>
              </div>
            </div>
          </div>

          {/* Interactive SVG Doha Map */}
          <div className="flex-1 bg-slate-900 relative overflow-hidden flex items-center justify-center p-6">
            <div className="absolute inset-0 opacity-15 dot-pattern"></div>
            {/* Mock Map Shapes */}
            <svg viewBox="0 0 500 350" className="w-full h-full text-slate-800 opacity-60">
              <path d="M 50,50 Q 150,120 250,50 T 450,50 L 450,300 Q 300,320 250,280 T 50,300 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M 120,80 Q 200,160 280,100 T 400,120" fill="none" stroke="currentColor" strokeWidth="1" />
              {/* Doha Bay Curve */}
              <path d="M 320,180 Q 380,240 480,220" fill="none" stroke="#0058be" strokeWidth="6" className="opacity-40" />
            </svg>

            {/* Glowing Map Pins for active workers */}
            {data.attendance.slice(0, 4).map((rec, idx) => {
              // Generate slightly varied positions
              const xPos = [180, 260, 120, 310][idx % 4];
              const yPos = [120, 210, 160, 260][idx % 4];
              const glowColor = rec.checkOut ? "bg-slate-400" : (rec.status === "Late" ? "bg-status-warning" : "bg-status-success");
              const shadowClass = rec.status === "Late" ? "shadow-[0_0_12px_#F9AB00]" : "shadow-[0_0_12px_#1E8E3E]";

              return (
                <div
                  key={rec.id}
                  className="absolute flex flex-col items-center group/pin"
                  style={{ left: `${xPos}px`, top: `${yPos}px` }}
                >
                  <div className={`w-3.5 h-3.5 rounded-full ${glowColor} ${shadowClass} animate-pulse border-2 border-white`}></div>
                  <div className="hidden group-hover/pin:flex absolute top-5 z-20 bg-slate-950 text-white text-[10px] p-2 rounded shadow-xl whitespace-nowrap flex-col gap-0.5 border border-slate-700">
                    <p className="font-bold">{rec.employeeName}</p>
                    <p className="opacity-75">{rec.locationName}</p>
                    <p className="opacity-75">{new Date(rec.checkIn).toLocaleTimeString()}</p>
                  </div>
                </div>
              );
            })}

            <div className="absolute bottom-4 right-4 z-10 flex gap-2">
              <button className="bg-primary text-on-primary w-8 h-8 flex items-center justify-center rounded shadow-lg hover:scale-105 active:scale-95 transition-transform"><span className="material-symbols-outlined text-[18px]">add</span></button>
              <button className="bg-primary text-on-primary w-8 h-8 flex items-center justify-center rounded shadow-lg hover:scale-105 active:scale-95 transition-transform"><span className="material-symbols-outlined text-[18px]">remove</span></button>
            </div>
          </div>
        </Card>

        {/* Workforce Density Clusters */}
        <Card className="flex flex-col gap-4">
          <div className="flex justify-between items-center border-b border-border-subtle pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Workforce Clusters</h3>
            <span className="material-symbols-outlined text-secondary">analytics</span>
          </div>
          <div className="space-y-4 flex-1 justify-center flex flex-col">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-on-surface">
                <span>Doha Head Office</span>
                <span className="text-primary font-bold">452 workers</span>
              </div>
              <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full" style={{ width: "85%" }}></div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-on-surface">
                <span>West Bay Project Site</span>
                <span className="text-primary font-bold">210 workers</span>
              </div>
              <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden">
                <div className="bg-secondary h-full rounded-full" style={{ width: "40%" }}></div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold text-on-surface">
                <span>Lusail Depot</span>
                <span className="text-primary font-bold">674 workers</span>
              </div>
              <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden">
                <div className="bg-status-success h-full rounded-full" style={{ width: "95%" }}></div>
              </div>
            </div>
          </div>
          <Button className="w-full font-bold">Optimize Rotations</Button>
        </Card>
      </div>

      {/* Critical Approvals & Operations Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Critical Approvals Queue */}
        <Card className="flex flex-col">
          <div className="p-4 border-b border-border-subtle bg-surface-container-low flex justify-between items-center -mx-6 -mt-6 rounded-t-xl">
            <h3 className="text-xs font-bold uppercase text-primary">Critical Approvals</h3>
            <Badge variant={pendingRequests > 0 ? "error" : "success"}>
              {pendingRequests} Pending
            </Badge>
          </div>
          <div className="flex-1 overflow-y-auto mt-4 max-h-[300px] divide-y divide-border-subtle">
            {data.leaves.filter(l => l.status === "Pending Approval").length === 0 ? (
              <div className="py-8 text-center text-xs text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl text-status-success/35 mb-2">check_circle</span>
                <p>All leaves and swaps resolved!</p>
              </div>
            ) : (
              data.leaves
                .filter(l => l.status === "Pending Approval")
                .map((req) => (
                  <div key={req.id} className="py-3.5 flex justify-between items-center gap-3">
                    <div>
                      <p className="text-xs font-bold text-primary">{req.type}</p>
                      <p className="text-[10px] text-on-surface-variant font-medium">
                        {req.employeeName} · {req.dateRange}
                      </p>
                      <p className="text-[10px] italic text-on-surface-variant mt-1">"{req.reason}"</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => handleLeaveAction(req.id, "Approved")}
                        className="w-7 h-7 bg-status-success/10 text-status-success rounded-full flex items-center justify-center hover:bg-status-success hover:text-white transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">check</span>
                      </button>
                      <button
                        onClick={() => handleLeaveAction(req.id, "Rejected")}
                        className="w-7 h-7 bg-status-error/10 text-status-error rounded-full flex items-center justify-center hover:bg-status-error hover:text-white transition-colors"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </Card>

        {/* Ledger Checklist */}
        <Card className="lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">Field Operations Ledger</h3>
            <div className="flex items-center gap-2">
              <input
                className="pl-8 pr-4 py-1 bg-surface-container text-xs rounded-lg focus:outline-none focus:ring-1 focus:ring-primary w-48 border-none"
                placeholder="Search by worker or ID..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <select
                className="bg-surface-container text-xs rounded-lg border-none py-1 px-3 focus:ring-1 focus:ring-primary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="On Duty">On Duty</option>
                <option value="On Break">On Break</option>
                <option value="Offline">Offline</option>
                <option value="On Leave">On Leave</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                <tr>
                  <th className="p-3 border-b">ID</th>
                  <th className="p-3 border-b">Field Member</th>
                  <th className="p-3 border-b">Status</th>
                  <th className="p-3 border-b">Device Connection</th>
                  <th className="p-3 border-b text-right">Sync Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle text-xs">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-on-surface-variant">
                      No matching records found.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => {
                    // Find matching attendance record
                    const activeAtt = data.attendance.find((a) => a.employeeId === emp.id);
                    const isSyncing = syncingId === emp.id;

                    return (
                      <tr key={emp.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-3 font-mono text-[10px]">{emp.id}</td>
                        <td className="p-3 font-bold text-primary">{emp.name}</td>
                        <td className="p-3">
                          <Badge
                            variant={
                              emp.status === "On Duty"
                                ? "success"
                                : emp.status === "On Break"
                                ? "warning"
                                : emp.status === "On Leave"
                                ? "pending"
                                : "neutral"
                            }
                          >
                            {emp.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-on-surface-variant font-medium">
                          {activeAtt ? activeAtt.device : "Offline · No Active GPS"}
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isSyncing}
                            onClick={() => handleSyncWorker(emp.id)}
                            className="font-bold flex items-center gap-1.5 ml-auto text-[10px]"
                          >
                            <span className={`material-symbols-outlined text-sm ${isSyncing ? "animate-spin" : ""}`}>
                              {isSyncing ? "sync" : "cloud_sync"}
                            </span>
                            <span>{isSyncing ? "Syncing..." : "Sync SF"}</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
