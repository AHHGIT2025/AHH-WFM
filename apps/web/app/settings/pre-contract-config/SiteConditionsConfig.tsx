"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, Modal } from '@ahh-wfm/ui';
import { Plus, Edit2, Copy, CheckCircle, XCircle } from 'lucide-react';

interface SiteCondition {
  id: string;
  category: string;
  definition: string;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
}

export default function SiteConditionsConfig() {
  const [conditions, setConditions] = useState<SiteCondition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCondition, setEditingCondition] = useState<SiteCondition | null>(null);
  
  const [category, setCategory] = useState('');
  const [definition, setDefinition] = useState('');

  const fetchConditions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/settings/pre-contract/site-conditions');
      if (res.ok) {
        const data = await res.json();
        setConditions(data);
      } else {
        setConditions([
          { id: '1', category: 'Access', definition: 'Site has clear vehicle access.', status: 'ACTIVE' },
          { id: '2', category: 'Safety', definition: 'Requires hardhats and safety boots.', status: 'DRAFT' },
        ]);
      }
    } catch (e) {
      console.error(e);
      setConditions([
        { id: '1', category: 'Access', definition: 'Site has clear vehicle access.', status: 'ACTIVE' },
        { id: '2', category: 'Safety', definition: 'Requires hardhats and safety boots.', status: 'DRAFT' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConditions();
  }, []);

  const openNewModal = () => {
    setEditingCondition(null);
    setCategory('');
    setDefinition('');
    setIsModalOpen(true);
  };

  const openEditModal = (c: SiteCondition) => {
    setEditingCondition(c);
    setCategory(c.category);
    setDefinition(c.definition);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const method = editingCondition ? 'PUT' : 'POST';
      const url = editingCondition ? `/api/v1/settings/pre-contract/site-conditions/${editingCondition.id}` : '/api/v1/settings/pre-contract/site-conditions';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, definition })
      });
      setIsModalOpen(false);
      fetchConditions();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold">Site Conditions</h2>
          <p className="text-sm text-muted-foreground">Manage categories and definitions for site conditions.</p>
        </div>
        <Button onClick={openNewModal}>
          <Plus className="w-4 h-4 mr-2" /> New Condition
        </Button>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-4 py-3 font-bold text-on-surface-variant">Category</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant">Definition</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant">Status</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading conditions...</td>
                </tr>
              ) : conditions.map(c => (
                <tr key={c.id} className="hover:bg-surface-container-lowest transition-colors">
                  <td className="px-4 py-3 font-medium">{c.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.definition}</td>
                  <td className="px-4 py-3">
                    <Badge variant={c.status === 'ACTIVE' ? 'success' : c.status === 'DRAFT' ? 'pending' : 'neutral'}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {c.status === 'DRAFT' && (
                      <Button variant="ghost" size="xs" onClick={() => openEditModal(c)} title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="xs" title="Clone">
                      <Copy className="w-4 h-4" />
                    </Button>
                    {c.status === 'DRAFT' && (
                      <Button variant="ghost" size="xs" title="Activate">
                        <CheckCircle className="w-4 h-4 text-status-success" />
                      </Button>
                    )}
                    {c.status === 'ACTIVE' && (
                      <Button variant="ghost" size="xs" title="Retire">
                        <XCircle className="w-4 h-4 text-status-warning" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {conditions.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No site conditions found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCondition ? 'Edit Site Condition' : 'New Site Condition'} size="md">
        <div className="space-y-4 pt-2">
          <Input 
            label="Category" 
            value={category} 
            onChange={(e) => setCategory(e.target.value)} 
            placeholder="e.g. Access, Safety"
          />
          <div className="space-y-1">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Definition</label>
            <textarea 
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[100px]"
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder="Enter definition..."
            />
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Condition</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
