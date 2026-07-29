import React from 'react';

export default function PreContractConfigPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pre-Contract Configuration</h1>
        <p className="text-muted-foreground">Manage templates, site conditions, and cost configuration for Pre-Contract workflows.</p>
      </div>

      <div className="w-full">
        <div className="mb-4 flex space-x-4">
          <button className="font-bold">Survey Configuration</button>
          <button className="font-bold">Site Conditions</button>
          <button className="font-bold">Cost Configuration</button>
        </div>

        <div className="border p-4 rounded">
          <h2 className="text-xl">Survey Templates</h2>
          <p className="text-sm text-muted-foreground">Manage survey templates and versions here.</p>
        </div>

        <div className="border p-4 rounded mt-4">
          <h2 className="text-xl">Site Conditions</h2>
          <p className="text-sm text-muted-foreground">Manage site conditions and categories here.</p>
        </div>

        <div className="border p-4 rounded mt-4">
          <h2 className="text-xl">Cost Configuration</h2>
          <p className="text-sm text-muted-foreground">Manage cost configurations, rates, and formulas here.</p>
        </div>
      </div>
    </div>
  );
}
