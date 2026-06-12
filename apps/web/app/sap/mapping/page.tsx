"use client";

import React, { useState, useEffect } from "react";
import { SapMapping } from "@ahh-wfm/types";
import { Card, Badge, Button } from "@ahh-wfm/ui/src";

export default function SapMappingPage() {
  const [mappings, setMappings] = useState<SapMapping[]>([]);

  const fetchMappings = async () => {
    try {
      const res = await fetch("/api/v1/sap/mapping");
      if (res.ok) {
        const json = await res.json();
        setMappings(json);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const handleResolveConflict = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/sap/mapping/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Mapped" })
      });
      if (res.ok) {
        fetchMappings();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary">SAP Field Mapping</h1>
          <p className="text-sm text-on-surface-variant">Configure data schema translation and rules between SuccessFactors API and WFM</p>
        </div>
        <Button className="font-bold flex items-center gap-1.5 text-xs">
          <span className="material-symbols-outlined text-[18px]">add</span> Add Field Mapping
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container text-[10px] font-bold uppercase tracking-wider text-on-surface-variant border-b border-border-subtle">
              <tr>
                <th className="p-4">SuccessFactors Field (Source)</th>
                <th className="p-4">WFM Local Field (Target)</th>
                <th className="p-4">Transformation Rule</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle text-xs">
              {mappings.map((mapping) => (
                <tr key={mapping.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="p-4">
                    <span className="font-mono bg-surface-container px-2.5 py-1 rounded text-primary font-bold text-[11px]">
                      {mapping.sourceField}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-mono bg-secondary-container/10 px-2.5 py-1 rounded text-secondary font-bold text-[11px]">
                      {mapping.targetField}
                    </span>
                  </td>
                  <td className="p-4 text-on-surface-variant font-medium">{mapping.transformationRule}</td>
                  <td className="p-4">
                    <Badge variant={mapping.status === "Mapped" ? "success" : "error"}>
                      {mapping.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-right">
                    {mapping.status === "Conflict" ? (
                      <Button
                        variant="warning"
                        size="sm"
                        className="font-bold text-[10px] py-1 px-3"
                        onClick={() => handleResolveConflict(mapping.id)}
                      >
                        Auto Resolve
                      </Button>
                    ) : (
                      <button className="text-secondary hover:underline font-bold text-[10px]">Edit Rule</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
