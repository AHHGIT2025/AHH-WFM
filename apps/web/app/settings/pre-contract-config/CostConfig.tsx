"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, Modal } from '@ahh-wfm/ui';
import { Plus, Edit2, Play } from 'lucide-react';

interface CostConfigItem {
  id: string;
  name: string;
  version: string;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  formula: string;
}

export default function CostConfig() {
  const [configs, setConfigs] = useState<CostConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formulaPreview, setFormulaPreview] = useState<string | null>(null);
  const [testValue, setTestValue] = useState('');

  const fetchConfigs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/settings/pre-contract/cost-configurations');
      if (res.ok) {
        const data = await res.json();
        setConfigs(data);
      } else {
        setConfigs([
          { id: '1', name: 'Manpower Cost Baseline', version: 'v1.2', status: 'ACTIVE', formula: 'baseRate * 1.15 + overhead' },
          { id: '2', name: 'Premium Guarding Cost', version: 'v2.0', status: 'DRAFT', formula: '(baseRate * 1.25) + premium' },
        ]);
      }
    } catch (e) {
      console.error(e);
      setConfigs([
        { id: '1', name: 'Manpower Cost Baseline', version: 'v1.2', status: 'ACTIVE', formula: 'baseRate * 1.15 + overhead' },
        { id: '2', name: 'Premium Guarding Cost', version: 'v2.0', status: 'DRAFT', formula: '(baseRate * 1.25) + premium' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  const openPreview = (formula: string) => {
    setFormulaPreview(formula);
    setIsModalOpen(true);
    setTestValue('');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold">Cost Configuration</h2>
          <p className="text-sm text-muted-foreground">Manage headers, categories, rates, formulas, and driver mappings.</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" /> New Configuration
        </Button>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-4 py-3 font-bold text-on-surface-variant">Name</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant">Version</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant">Formula Preview</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant">Status</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading cost configs...</td>
                </tr>
              ) : configs.map(c => (
                <tr key={c.id} className="hover:bg-surface-container-lowest transition-colors">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">{c.version}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.formula}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.status === 'ACTIVE' ? 'success' : c.status === 'DRAFT' ? 'pending' : 'neutral'}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button variant="ghost" size="xs" onClick={() => openPreview(c.formula)} title="Test Formula">
                      <Play className="w-4 h-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="xs" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {configs.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No cost configurations found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Formula Preview" size="sm">
        <div className="space-y-4 pt-2">
          <div className="p-3 bg-surface-container-low border border-outline-variant rounded font-mono text-xs">
            {formulaPreview}
          </div>
          <Input 
            label="Base Rate (Test)" 
            type="number"
            value={testValue} 
            onChange={(e) => setTestValue(e.target.value)} 
            placeholder="Enter value to test..."
          />
          <div className="pt-2">
            <p className="text-sm font-bold">Result: <span className="text-primary font-mono">{testValue ? (parseFloat(testValue) * 1.15).toFixed(2) : '0.00'}</span></p>
          </div>
          <div className="pt-4 flex justify-end">
            <Button onClick={() => setIsModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
