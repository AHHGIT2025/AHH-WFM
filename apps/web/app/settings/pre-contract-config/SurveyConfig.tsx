"use client";

import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Badge, Modal } from '@ahh-wfm/ui';
import { Plus, Edit2, Copy, CheckCircle, Trash2, ChevronRight, XCircle } from 'lucide-react';

interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
  version: string;
}

export default function SurveyConfig() {
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SurveyTemplate | null>(null);
  
  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/settings/pre-contract/survey-templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      } else {
        // Fallback for UI if API is not yet available
        setTemplates([
          { id: '1', name: 'Standard Facility Survey', description: 'Base template for facility management', status: 'ACTIVE', version: '1.0' },
          { id: '2', name: 'Security Guarding Assessement', description: 'Template for security guarding', status: 'DRAFT', version: '2.1' },
        ]);
      }
    } catch (e) {
      console.error(e);
      setTemplates([
        { id: '1', name: 'Standard Facility Survey', description: 'Base template for facility management', status: 'ACTIVE', version: '1.0' },
        { id: '2', name: 'Security Guarding Assessement', description: 'Template for security guarding', status: 'DRAFT', version: '2.1' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const openNewModal = () => {
    setEditingTemplate(null);
    setName('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (t: SurveyTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setDescription(t.description);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const method = editingTemplate ? 'PUT' : 'POST';
      const url = editingTemplate ? `/api/v1/settings/pre-contract/survey-templates/${editingTemplate.id}` : '/api/v1/settings/pre-contract/survey-templates';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });
      setIsModalOpen(false);
      fetchTemplates();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await fetch(`/api/v1/settings/pre-contract/survey-templates/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      fetchTemplates();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold">Survey Templates</h2>
          <p className="text-sm text-muted-foreground">Manage templates, versions, sections, and rules.</p>
        </div>
        <Button onClick={openNewModal}>
          <Plus className="w-4 h-4 mr-2" /> New Template
        </Button>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low border-b border-outline-variant">
              <tr>
                <th className="px-4 py-3 font-bold text-on-surface-variant">Name</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant">Description</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant">Version</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant">Status</th>
                <th className="px-4 py-3 font-bold text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading templates...</td>
                </tr>
              ) : templates.map(t => (
                <tr key={t.id} className="hover:bg-surface-container-lowest transition-colors">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.description}</td>
                  <td className="px-4 py-3">{t.version}</td>
                  <td className="px-4 py-3">
                    <Badge variant={t.status === 'ACTIVE' ? 'success' : t.status === 'DRAFT' ? 'pending' : 'neutral'}>
                      {t.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    {t.status === 'DRAFT' && (
                      <Button variant="ghost" size="xs" onClick={() => openEditModal(t)} title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="xs" title="Clone">
                      <Copy className="w-4 h-4" />
                    </Button>
                    {t.status === 'DRAFT' && (
                      <Button variant="ghost" size="xs" onClick={() => handleStatusChange(t.id, 'ACTIVE')} title="Activate">
                        <CheckCircle className="w-4 h-4 text-status-success" />
                      </Button>
                    )}
                    {t.status === 'ACTIVE' && (
                      <Button variant="ghost" size="xs" onClick={() => handleStatusChange(t.id, 'RETIRED')} title="Retire">
                        <XCircle className="w-4 h-4 text-status-warning" />
                      </Button>
                    )}
                    <Button variant="ghost" size="xs" title="View Details">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No templates found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTemplate ? 'Edit Template' : 'New Template'} size="md">
        <div className="space-y-4 pt-2">
          <Input 
            label="Template Name" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="Enter template name..."
          />
          <div className="space-y-1">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">Description</label>
            <textarea 
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[100px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter description..."
            />
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Template</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
