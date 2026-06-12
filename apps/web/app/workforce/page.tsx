"use client";

import React, { useState, useEffect } from "react";
import { Employee } from "@ahh-wfm/types";
import { Card, Badge, Input, Button } from "@ahh-wfm/ui/src";

export default function WorkforcePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");

  const fetchEmployees = async () => {
    try {
      const res = await fetch("/api/v1/employees");
      if (res.ok) {
        const json = await res.json();
        setEmployees(json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const filtered = employees.filter((emp) => {
    const matchesSearch = emp.name.toLowerCase().includes(search.toLowerCase()) || emp.id.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === "all" || emp.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">Workforce Directory</h1>
          <p className="text-sm text-on-surface-variant">List of all registered field engineers, inspectors, and logistics staff</p>
        </div>
        <Button className="font-bold flex items-center gap-1.5 self-start sm:self-auto">
          <span className="material-symbols-outlined text-[18px]">person_add</span>
          <span>Add Employee</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
          <input
            className="pl-10 pr-4 py-2 border border-outline-variant rounded-lg bg-surface text-sm w-full focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            placeholder="Search by name, ID or email..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="bg-surface border border-outline-variant text-sm rounded-lg py-2 px-4 focus:ring-2 focus:ring-primary/20 focus:border-primary w-full sm:w-48 outline-none"
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
        >
          <option value="all">All Departments</option>
          <option value="Operations">Operations</option>
          <option value="Engineering">Engineering</option>
          <option value="Logistics">Logistics</option>
          <option value="Sales">Sales</option>
        </select>
      </Card>

      {/* Employee Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((emp) => (
          <Card key={emp.id} className="flex flex-col justify-between">
            <div className="flex justify-between items-start gap-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary-container/10 flex items-center justify-center font-bold text-primary border border-secondary-container/20">
                  {emp.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <h3 className="font-bold text-primary text-sm">{emp.name}</h3>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{emp.role}</p>
                </div>
              </div>
              <Badge variant={emp.status === "On Duty" ? "success" : emp.status === "On Break" ? "warning" : emp.status === "On Leave" ? "pending" : "neutral"}>
                {emp.status}
              </Badge>
            </div>

            <div className="mt-4 pt-4 border-t border-border-subtle grid grid-cols-2 gap-y-2 gap-x-4 text-[11px] text-on-surface-variant">
              <div>
                <p className="opacity-60 font-semibold uppercase">ID</p>
                <p className="font-mono text-xs mt-0.5 text-primary font-bold">{emp.id}</p>
              </div>
              <div>
                <p className="opacity-60 font-semibold uppercase">Department</p>
                <p className="font-bold text-primary mt-0.5">{emp.department}</p>
              </div>
              <div className="col-span-2">
                <p className="opacity-60 font-semibold uppercase">Email</p>
                <p className="font-medium text-primary mt-0.5 break-all">{emp.email}</p>
              </div>
              {emp.phone && (
                <div className="col-span-2">
                  <p className="opacity-60 font-semibold uppercase">Phone</p>
                  <p className="font-medium text-primary mt-0.5">{emp.phone}</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-2">
              <Button variant="secondary" className="flex-1 font-bold text-xs py-1.5">Edit Profile</Button>
              <Button variant="ghost" className="p-2 border border-outline-variant">
                <span className="material-symbols-outlined text-sm">chat</span>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
