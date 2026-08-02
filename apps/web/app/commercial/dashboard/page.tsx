"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card } from "@ahh-wfm/ui";
import { useSession } from "next-auth/react";

export default function CommercialDashboard() {
  const { data: session } = useSession();

  // Mock statistics for the CL-0 dashboard shell
  const stats = [
    { label: "CRM Enquiries", value: "42", change: "+12% this week", icon: "chat", color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Opportunities", value: "18", change: "+5% vs target", icon: "lightbulb", color: "text-amber-500", bg: "bg-amber-50" },
    { label: "Site Surveys", value: "12", change: "3 pending dispatch", icon: "explore", color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Active Costings", value: "8", change: "2 under review", icon: "payments", color: "text-purple-600", bg: "bg-purple-50" },
    { label: "Pending Quotations", value: "5", change: "1 awaiting legal", icon: "request_quote", color: "text-sky-600", bg: "bg-sky-50" },
    { label: "Active Contracts", value: "9", change: "2 addendums active", icon: "description", color: "text-teal-600", bg: "bg-teal-50" },
  ];

  const workQueue = [
    {
      id: "TASK-01",
      priority: "High",
      priorityColor: "bg-rose-50 text-rose-700 border-rose-200",
      description: "Review Quotation #QT-788 client deviations",
      record: "#QT-788",
      link: "/commercial/quotations",
      assigned: "Elena Rodriguez",
      role: "Legal",
      status: "Awaiting Action"
    },
    {
      id: "TASK-02",
      priority: "Medium",
      priorityColor: "bg-amber-50 text-amber-700 border-amber-200",
      description: "Approve Costing model #CST-551 margin exceptions",
      record: "#CST-551",
      link: "/commercial/costing",
      assigned: "Julian Vane",
      role: "Finance",
      status: "In Progress"
    },
    {
      id: "TASK-03",
      priority: "Medium",
      priorityColor: "bg-amber-50 text-amber-700 border-amber-200",
      description: "Schedule pre-contract site survey for Nexus Holdings",
      record: "#ENQ-9902",
      link: "/commercial/surveys",
      assigned: "Marcus Holloway",
      role: "Operations",
      status: "Pending Review"
    }
  ];

  const activities = [
    {
      action: "Quotation V1.2 generated & saved to contract draft",
      user: "Sarah Chen (Sales)",
      time: "Today, 10:00 AM",
      icon: "article",
      color: "text-sky-600"
    },
    {
      action: "Costing #CST-551 verified for margin compliance",
      user: "Julian Vane (Finance)",
      time: "Yesterday, 02:45 PM",
      icon: "payments",
      color: "text-purple-600"
    },
    {
      action: "Pre-Contract Site Survey #SRV-102 v2 conducted & logged",
      user: "Marcus Holloway (Operations)",
      time: "Oct 22, 11:30 AM",
      icon: "explore",
      color: "text-emerald-600"
    }
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#091426]">Commercial & Contracts Command Center</h1>
          <p className="text-sm text-gray-500 mt-1">
            Consolidated commercial lifecycle hub: from customer enquiry intake to active contract mobilization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings/pre-contract-config"
            className="px-4 py-2 border border-[#c5c6cd] hover:bg-gray-50 text-xs font-bold rounded-lg text-[#091426] transition-colors inline-flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">settings</span>
            Commercial Settings
          </Link>
        </div>
      </div>

      {/* Summary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="p-4 border border-[#c5c6cd] hover:shadow-sm transition-all flex flex-col justify-between h-32 bg-white">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{stat.label}</span>
              <div className={`p-2 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center shrink-0`}>
                <span className="material-symbols-outlined text-lg">{stat.icon}</span>
              </div>
            </div>
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-[#091426]">{stat.value}</span>
              <p className="text-[10px] text-gray-500 mt-1">{stat.change}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border border-[#c5c6cd] bg-white flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">trending_up</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Total Pipeline Value</span>
            <h2 className="text-xl font-extrabold text-[#091426] mt-0.5">£2.48M</h2>
            <p className="text-[10px] text-[#1E8E3E] font-bold flex items-center gap-1 mt-0.5">
              <span>+8.2% vs target</span>
            </p>
          </div>
        </Card>
        <Card className="p-5 border border-[#c5c6cd] bg-white flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">verified</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Commercial Win Rate</span>
            <h2 className="text-xl font-extrabold text-[#091426] mt-0.5">75.0%</h2>
            <p className="text-[10px] text-gray-500 mt-0.5">Based on last 12 opportunities</p>
          </div>
        </Card>
        <Card className="p-5 border border-[#c5c6cd] bg-white flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">timelapse</span>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Avg. Mobilization Speed</span>
            <h2 className="text-xl font-extrabold text-[#091426] mt-0.5">14.2 Days</h2>
            <p className="text-[10px] text-[#1E8E3E] font-bold flex items-center gap-1 mt-0.5">
              <span>SLA Target: 15 Days (Met)</span>
            </p>
          </div>
        </Card>
      </div>

      {/* Main Content Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Team Work Queue */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Active Team Work Queue</h2>
            <span className="text-xs text-gray-500 font-medium">Updated 2 mins ago</span>
          </div>
          <Card padded={false} className="border border-[#c5c6cd] bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-3">Priority</th>
                    <th scope="col" className="px-6 py-3">Task Description</th>
                    <th scope="col" className="px-6 py-3">Reference</th>
                    <th scope="col" className="px-6 py-3">Assignee</th>
                    <th scope="col" className="px-6 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-medium text-[#091426]">
                  {workQueue.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${task.priorityColor}`}>
                          {task.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {task.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link href={task.link} className="text-[#0058be] hover:underline font-extrabold">
                          {task.record}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-secondary-container/20 flex items-center justify-center text-[10px] font-bold text-[#0058be] shrink-0">
                            {task.assigned.split(" ").map(n => n[0]).join("")}
                          </div>
                          <div>
                            <p className="text-xs font-bold">{task.assigned}</p>
                            <p className="text-[10px] text-gray-500 leading-none">{task.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="px-2.5 py-0.5 text-[10px] font-bold bg-[#091426]/5 text-[#091426] rounded-full border border-gray-200">
                          {task.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right 1 Column: Activity Feed */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">Deal Activity Feed</h2>
            <Link href="/commercial/activities" className="text-xs text-[#0058be] hover:underline font-bold">
              View All
            </Link>
          </div>
          <Card className="p-5 border border-[#c5c6cd] bg-white space-y-4">
            <div className="flow-root">
              <ul className="-mb-8">
                {activities.map((act, i) => (
                  <li key={i}>
                    <div className="relative pb-8">
                      {i !== activities.length - 1 && (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                      )}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center ring-8 ring-white shrink-0 ${act.color}`}>
                            <span className="material-symbols-outlined text-lg">{act.icon}</span>
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5">
                          <p className="text-xs text-[#091426] font-bold">{act.action}</p>
                          <div className="text-[10px] text-gray-500 mt-1 flex justify-between">
                            <span>{act.user}</span>
                            <span>{act.time}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
