"use client";

import React, { useState, useEffect } from "react";
import { Card, Badge, Button, Modal, Input } from "@ahh-wfm/ui/src";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function ClearanceDetail({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [clearance, setClearance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchClearance = () => {
    fetch(`/api/v1/clearance/${params.id}`)
      .then(res => res.json())
      .then(data => {
        if(data.success) setClearance(data.data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchClearance();
  }, [params.id]);

  const handleAction = async (action: string) => {
    // In a real app, this would open a modal to collect remarks before submitting
    const stepId = clearance.approvalSteps.find((s: any) => s.status === 'PENDING')?.id;
    if (!stepId && action !== 'submit' && action !== 'sign') return;

    let endpoint = `/api/v1/clearance/${params.id}/${action}`;
    let body: any = {};

    if (action === 'submit') {
      body = { templateId: "default-template-id" }; // normally selected by HR
    } else if (action === 'sign') {
      body = { signatureName: clearance.employeeNameSnapshot };
    } else {
      body = {
        stepId,
        actorId: (session?.user as any)?.id || "system",
        remarks: "Approved via UI",
      };
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) fetchClearance();
    } catch(err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;
  if (!clearance) return <div className="p-6">Clearance not found</div>;

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center bg-white p-4 rounded shadow-sm border-t-4 border-[#800000]">
        <div>
          <h1 className="text-2xl font-bold text-[#800000]">EMPLOYEE CLEARANCE FORM</h1>
          <div className="flex space-x-4 text-sm text-gray-500 mt-2">
            <span>Code No: {clearance.formCode || '26-12-2020'}</span>
            <span>Issue Ref: {clearance.issueRef || 'FM-14-04-02'}</span>
            <span>Issue Date: {clearance.issueDate || '26th DEC, 2020'}</span>
          </div>
        </div>
        <div className="space-x-2">
          <Button variant="ghost" onClick={() => window.open(`/clearance/${clearance.id}/print`, '_blank')}>Print Form</Button>
          <Badge variant={clearance.status === 'COMPLETED' ? 'success' : clearance.status === 'REJECTED' ? 'error' : 'warning'}>
            {clearance.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6 shadow-sm">
            <h2 className="text-lg font-semibold border-b pb-2 mb-4">Employee Details</h2>
            <div className="grid grid-cols-2 gap-y-4 text-sm">
              <div><span className="text-gray-500 block">Emp. Code</span> <span className="font-medium">{clearance.employeeCodeSnapshot}</span></div>
              <div><span className="text-gray-500 block">Emp. Name</span> <span className="font-medium">{clearance.employeeNameSnapshot}</span></div>
              <div><span className="text-gray-500 block">Designation</span> <span className="font-medium">{clearance.designationSnapshot}</span></div>
              <div><span className="text-gray-500 block">Working For</span> <span className="font-medium">{clearance.workingForSnapshot}</span></div>
              <div><span className="text-gray-500 block">QID Number</span> <span className="font-medium">{clearance.qidNumberSnapshot || '-'}</span></div>
              <div><span className="text-gray-500 block">Type of Process</span> <span className="font-medium">{clearance.typeOfProcess || clearance.clearanceType}</span></div>
              
              {clearance.clearanceType === 'LEAVE_VACATION' && (
                <>
                  <div><span className="text-gray-500 block">Departure Date</span> <span className="font-medium">{new Date(clearance.departureDate).toLocaleDateString()}</span></div>
                  <div><span className="text-gray-500 block">Returning Date</span> <span className="font-medium">{new Date(clearance.returningDate).toLocaleDateString()}</span></div>
                </>
              )}
              {clearance.clearanceType === 'SEPARATION' && (
                <>
                  <div><span className="text-gray-500 block">Separation Type</span> <span className="font-medium">{clearance.separationType}</span></div>
                  <div><span className="text-gray-500 block">Last Working Date</span> <span className="font-medium">{new Date(clearance.lastWorkingDate).toLocaleDateString()}</span></div>
                </>
              )}
            </div>
          </Card>

          <Card className="p-6 shadow-sm">
            <h2 className="text-lg font-semibold border-b pb-2 mb-4">Approval Departments</h2>
            {clearance.approvalSteps?.length === 0 ? (
              <div className="text-center text-gray-500 py-4">
                No approval steps generated yet.
                {clearance.status === 'DRAFT' && (
                  <div className="mt-4">
                    <Button variant="primary" className="bg-[#800000] text-white" onClick={() => handleAction('submit')}>Submit & Generate Routing</Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {clearance.approvalSteps?.map((step: any, idx: number) => (
                  <div key={step.id} className={`p-4 border rounded-md flex justify-between items-center ${step.status === 'PENDING' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'}`}>
                    <div>
                      <div className="font-medium text-gray-800">{idx + 1}. {step.sectionName}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {step.status === 'NOT_APPLICABLE' ? (
                          <span className="italic">Not Applicable: {step.notApplicableReason}</span>
                        ) : step.status === 'APPROVED' ? (
                          <span className="text-green-600">Approved by {step.signatureName} on {new Date(step.signatureDate).toLocaleDateString()}</span>
                        ) : step.status === 'PENDING' ? (
                          <span className="text-yellow-600">Waiting for approval</span>
                        ) : (
                          <span>{step.status}</span>
                        )}
                      </div>
                    </div>
                    {step.status === 'PENDING' && (
                       <div className="space-x-2">
                         <Button variant="ghost" className="text-green-600 border-green-600" onClick={() => handleAction('approve')}>Approve</Button>
                         <Button variant="ghost" className="text-red-600 border-red-600" onClick={() => handleAction('reject')}>Reject</Button>
                       </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 shadow-sm border-t-4 border-gray-800">
            <h2 className="text-lg font-semibold border-b pb-2 mb-4">Employee Declaration</h2>
            {clearance.employeeSignedAt ? (
              <div className="text-sm">
                <div className="text-green-600 font-medium mb-2">✓ Signed by Employee</div>
                <div className="text-gray-500">Name: {clearance.employeeSignatureName}</div>
                <div className="text-gray-500">Date: {new Date(clearance.employeeSignedAt).toLocaleString()}</div>
              </div>
            ) : (
              <div className="text-sm text-center">
                <p className="text-gray-500 mb-4">Employee signature is pending.</p>
                {clearance.status === 'PENDING_EMPLOYEE_SIGNATURE' && (
                  <Button variant="primary" className="bg-[#800000] text-white w-full" onClick={() => handleAction('sign')}>
                    Sign Declaration
                  </Button>
                )}
              </div>
            )}
          </Card>

          <Card className="p-6 shadow-sm">
            <h2 className="text-lg font-semibold border-b pb-2 mb-4">History</h2>
            <div className="space-y-4">
              {clearance.history?.map((h: any) => (
                <div key={h.id} className="text-sm">
                  <div className="text-gray-500 text-xs">{new Date(h.createdAt).toLocaleString()}</div>
                  <div className="font-medium">{h.actionType}</div>
                  <div className="text-gray-700">{h.details}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}