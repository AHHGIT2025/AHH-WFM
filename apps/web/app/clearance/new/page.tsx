"use client";

import React, { useState, useEffect } from "react";
import { Card, Button, Input, Select } from "@ahh-wfm/ui/src";
import { useRouter } from "next/navigation";

export default function NewClearanceRequest() {
  const router = useRouter();
  const [employees, setEmployees] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    employeeId: "",
    clearanceType: "LEAVE_VACATION",
    separationType: "",
    departureDate: "",
    returningDate: "",
    lastWorkingDate: "",
    typeOfProcess: "",
  });

  useEffect(() => {
    fetch("/api/v1/employees")
      .then(res => res.json())
      .then(data => {
        if(data.success || Array.isArray(data)) setEmployees(data.data || data);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/clearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if(data.success) {
        router.push(\`/clearance/\${data.data.id}\`);
      } else {
        alert("Error: " + data.error);
      }
    } catch(err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">New Clearance Request</h1>
        <Button variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>

      <Card className="p-6 max-w-4xl mx-auto shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold text-[#800000]">Employee Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Select Employee</label>
                <Select 
                  required
                  value={formData.employeeId} 
                  onChange={(e) => setFormData({...formData, employeeId: e.target.value})}
                  className="mt-1 block w-full"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName} ({emp.employeeCode})</option>
                  ))}
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Clearance Type</label>
                <Select 
                  required
                  value={formData.clearanceType} 
                  onChange={(e) => setFormData({...formData, clearanceType: e.target.value})}
                  className="mt-1 block w-full"
                >
                  <option value="LEAVE_VACATION">Leave / Vacation</option>
                  <option value="SEPARATION">Separation</option>
                </Select>
              </div>
            </div>
          </div>

          {formData.clearanceType === "SEPARATION" && (
            <div className="border-b pb-4">
              <h2 className="text-lg font-semibold text-[#800000]">Separation Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Separation Type</label>
                  <Select 
                    required
                    value={formData.separationType} 
                    onChange={(e) => setFormData({...formData, separationType: e.target.value})}
                    className="mt-1 block w-full"
                  >
                    <option value="">-- Select Type --</option>
                    <option value="RESIGNATION">Resignation</option>
                    <option value="TERMINATION">Termination</option>
                    <option value="END_OF_CONTRACT">End of Contract</option>
                    <option value="FINAL_EXIT">Final Exit</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Working Date</label>
                  <Input 
                    type="date" 
                    required
                    value={formData.lastWorkingDate} 
                    onChange={(e) => setFormData({...formData, lastWorkingDate: e.target.value})}
                    className="mt-1 block w-full"
                  />
                </div>
              </div>
            </div>
          )}

          {formData.clearanceType === "LEAVE_VACATION" && (
            <div className="border-b pb-4">
              <h2 className="text-lg font-semibold text-[#800000]">Leave Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Departure Date</label>
                  <Input 
                    type="date" 
                    required
                    value={formData.departureDate} 
                    onChange={(e) => setFormData({...formData, departureDate: e.target.value})}
                    className="mt-1 block w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Returning Date</label>
                  <Input 
                    type="date" 
                    required
                    value={formData.returningDate} 
                    onChange={(e) => setFormData({...formData, returningDate: e.target.value})}
                    className="mt-1 block w-full"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="border-b pb-4">
            <h2 className="text-lg font-semibold text-[#800000]">Additional Information</h2>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Type of Process</label>
              <Input 
                type="text" 
                value={formData.typeOfProcess} 
                onChange={(e) => setFormData({...formData, typeOfProcess: e.target.value})}
                placeholder="e.g. Exit Visa, Annual Leave..."
                className="mt-1 block w-full"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" variant="primary" className="bg-[#800000] text-white">Create Clearance Draft</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}