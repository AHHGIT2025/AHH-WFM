import React from 'react';

export default function ClearanceApprovals() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Pending Approvals</h1>
      <div className="bg-white rounded shadow p-4">
        <p>List of pending approvals for the current user goes here.</p>
      </div>
    </div>
  );
}