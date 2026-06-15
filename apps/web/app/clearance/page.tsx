"use client";

import React, { useState, useEffect } from "react";
import { Card, Badge, Button, Input, Modal } from "@ahh-wfm/ui/src";
import { useSession } from "next-auth/react";

export default function ClearanceDashboard() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"overview" | "requests" | "approvals">("overview");
  const [clearances, setClearances] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/v1/clearance")
      .then(res => res.json())
      .then(data => {
        if(data.success) setClearances(data.data);
      });
  }, []);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Clearance Management</h1>
        <Button variant="primary" className="bg-[#800000] text-white" onClick={() => window.location.href = '/clearance/new'}>
          + New Clearance
        </Button>
      </div>

      <div className="flex space-x-4 border-b border-gray-200">
        <button 
          onClick={() => setActiveTab("overview")}
          className={`pb-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview' ? 'border-[#800000] text-[#800000]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Overview
        </button>
        <button 
          onClick={() => setActiveTab("requests")}
          className={`pb-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'requests' ? 'border-[#800000] text-[#800000]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          All Requests
        </button>
        <button 
          onClick={() => setActiveTab("approvals")}
          className={`pb-2 px-1 border-b-2 font-medium text-sm ${activeTab === 'approvals' ? 'border-[#800000] text-[#800000]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          My Approvals
        </button>
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 border-t-4 border-[#800000]">
            <h3 className="text-sm font-medium text-gray-500">Pending Clearances</h3>
            <p className="text-2xl font-bold text-gray-900">{clearances.filter(c => c.status !== 'COMPLETED').length}</p>
          </Card>
          <Card className="p-4 border-t-4 border-yellow-500">
            <h3 className="text-sm font-medium text-gray-500">Waiting for My Approval</h3>
            <p className="text-2xl font-bold text-gray-900">0</p>
          </Card>
          <Card className="p-4 border-t-4 border-blue-500">
            <h3 className="text-sm font-medium text-gray-500">Leave Clearances</h3>
            <p className="text-2xl font-bold text-gray-900">{clearances.filter(c => c.clearanceType === 'LEAVE_VACATION').length}</p>
          </Card>
          <Card className="p-4 border-t-4 border-green-500">
            <h3 className="text-sm font-medium text-gray-500">Completed This Month</h3>
            <p className="text-2xl font-bold text-gray-900">{clearances.filter(c => c.status === 'COMPLETED').length}</p>
          </Card>
        </div>
      )}

      {(activeTab === "requests" || activeTab === "approvals") && (
        <Card className="p-0 overflow-hidden shadow-sm">
          <div className="p-4 bg-white border-b flex items-center space-x-4">
            <Input placeholder="Search Employee..." className="max-w-xs" />
            <Button variant="secondary">Filters</Button>
            <Button variant="ghost">Reset Filters</Button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clearance No.</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clearances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                      No clearances found
                    </td>
                  </tr>
                ) : (
                  clearances.map((c) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#800000]">{c.clearanceNumber}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{c.employeeNameSnapshot} <span className="text-gray-500 block text-xs">{c.employeeCodeSnapshot}</span></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.workingForSnapshot}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{c.clearanceType}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge variant={c.status === "COMPLETED" ? "success" : "warning"}>{c.status}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <Button variant="ghost" size="sm" onClick={() => window.location.href = `/clearance/${c.id}`}>View</Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}