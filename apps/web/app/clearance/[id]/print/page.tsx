"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

export default function ClearancePrint({ params }: { params: { id: string } }) {
  const [clearance, setClearance] = useState<any>(null);

  useEffect(() => {
    fetch(\`/api/v1/clearance/\${params.id}\`)
      .then(res => res.json())
      .then(data => {
        if(data.success) setClearance(data.data);
      });
  }, [params.id]);

  if (!clearance) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 bg-white text-black min-h-screen max-w-5xl mx-auto print:p-0 print:m-0" style={{ fontFamily: "Arial, sans-serif" }}>
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold underline mb-4">EMPLOYEE CLEARANCE FORM</h1>
        <div className="flex justify-between text-sm font-semibold border-b pb-2">
          <span>Code No: {clearance.formCode || '26-12-2020'}</span>
          <span>Issue Ref: {clearance.issueRef || 'FM-14-04-02'}</span>
          <span>Issue Date: {clearance.issueDate || '26th DEC, 2020'}</span>
        </div>
      </div>

      {/* Employee Details */}
      <div className="mb-6 border border-black p-4">
        <h2 className="text-lg font-bold bg-gray-200 p-1 mb-2">Employee & Leave Details</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr>
              <td className="font-bold py-1 w-1/4">Emp. Code:</td>
              <td className="w-1/4 border-b border-gray-300">{clearance.employeeCodeSnapshot}</td>
              <td className="font-bold py-1 w-1/4 pl-4">Date of Joining:</td>
              <td className="w-1/4 border-b border-gray-300">{clearance.dateOfJoiningSnapshot ? new Date(clearance.dateOfJoiningSnapshot).toLocaleDateString() : ''}</td>
            </tr>
            <tr>
              <td className="font-bold py-1">Emp. Name:</td>
              <td className="border-b border-gray-300">{clearance.employeeNameSnapshot}</td>
              <td className="font-bold py-1 pl-4">Departure Date:</td>
              <td className="border-b border-gray-300">{clearance.departureDate ? new Date(clearance.departureDate).toLocaleDateString() : ''}</td>
            </tr>
            <tr>
              <td className="font-bold py-1">Designation:</td>
              <td className="border-b border-gray-300">{clearance.designationSnapshot}</td>
              <td className="font-bold py-1 pl-4">Returning Date:</td>
              <td className="border-b border-gray-300">{clearance.returningDate ? new Date(clearance.returningDate).toLocaleDateString() : ''}</td>
            </tr>
            <tr>
              <td className="font-bold py-1">Working For:</td>
              <td className="border-b border-gray-300">{clearance.workingForSnapshot}</td>
              <td className="font-bold py-1 pl-4">Type of Process:</td>
              <td className="border-b border-gray-300">{clearance.typeOfProcess || clearance.clearanceType}</td>
            </tr>
            <tr>
              <td className="font-bold py-1">QID Number:</td>
              <td className="border-b border-gray-300">{clearance.qidNumberSnapshot}</td>
              <td className="font-bold py-1 pl-4">QID Expiry Date:</td>
              <td className="border-b border-gray-300">{clearance.qidExpiryDateSnapshot ? new Date(clearance.qidExpiryDateSnapshot).toLocaleDateString() : ''}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Approval Departments Table */}
      <table className="w-full text-sm border-collapse border border-black mb-6">
        <thead>
          <tr className="bg-gray-200">
            <th className="border border-black p-2 w-1/4 text-left">Department</th>
            <th className="border border-black p-2 w-1/2 text-left">Notes / Remarks</th>
            <th className="border border-black p-2 w-1/4 text-center">Signature & Date</th>
          </tr>
        </thead>
        <tbody>
          {clearance.approvalSteps?.map((step: any) => (
            <tr key={step.id}>
              <td className="border border-black p-2 font-semibold">{step.sectionName}</td>
              <td className="border border-black p-2">
                {step.status === 'NOT_APPLICABLE' ? 'Not Applicable - ' + step.notApplicableReason : step.remarks || ''}
              </td>
              <td className="border border-black p-2 text-center text-xs">
                {step.status === 'APPROVED' ? (
                  <>
                    <div className="font-bold font-script text-blue-800">{step.signatureName}</div>
                    <div>{new Date(step.signatureDate).toLocaleDateString()}</div>
                  </>
                ) : step.status === 'NOT_APPLICABLE' ? (
                  'N/A'
                ) : (
                  <div className="h-8"></div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Employee Signature */}
      <div className="flex justify-between items-end border border-black p-4 mb-6">
        <div>
          <p className="font-bold mb-4">Employee Declaration:</p>
          <p className="text-xs max-w-xl">I hereby declare that I have returned all company properties and settled all my obligations. I authorize the company to deduct any outstanding amounts from my final settlement.</p>
        </div>
        <div className="text-center w-64 border-t border-black pt-1">
          {clearance.employeeSignedAt ? (
             <div className="text-xs">
               <span className="font-script font-bold text-blue-800">{clearance.employeeSignatureName}</span><br />
               {new Date(clearance.employeeSignedAt).toLocaleDateString()}
             </div>
          ) : (
            <span className="text-xs">Employee Signature</span>
          )}
        </div>
      </div>

      {/* Executive Sign Off */}
      <div className="grid grid-cols-3 gap-4 text-center mt-12">
        <div>
          <div className="h-16 border-b border-black mb-2"></div>
          <p className="font-bold text-sm">Chief HR & Admin Affairs Officer</p>
        </div>
        <div>
          <div className="h-16 border-b border-black mb-2"></div>
          <p className="font-bold text-sm">Chief Executive Officer</p>
        </div>
        <div>
          <div className="h-16 border-b border-black mb-2"></div>
          <p className="font-bold text-sm">Vice Chairman</p>
        </div>
      </div>
    </div>
  );
}