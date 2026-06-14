"use client";

import React, { useState, useEffect } from "react";
import { Plus, Search, Edit2, PowerOff, CheckCircle2, X } from "lucide-react";
import { Card, Button, Input, Modal, Badge } from "@ahh-wfm/ui/src";

interface ColumnDef {
  key: string;
  label: string;
  type?: "text" | "number" | "boolean" | "select";
  required?: boolean;
  options?: { id: string; label: string }[];
  optionsApi?: string;
  optionLabel?: string;
}

interface TabConfig {
  id: string;
  label: string;
  icon: any;
  apiPath: string;
  columns: ColumnDef[];
}

export function MasterDataEntityTab({ config }: { config: TabConfig }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  // To hold dynamic options (like Companies list for a Select field)
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, any[]>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(config.apiPath);
      if (res.ok) {
        setData(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDynamicOptions = async () => {
    const newOptions: Record<string, any[]> = {};
    for (const col of config.columns) {
      if (col.type === "select" && col.optionsApi) {
        try {
          const res = await fetch(col.optionsApi);
          if (res.ok) {
            newOptions[col.key] = await res.json();
          }
        } catch (e) {
          console.error(e);
        }
      }
    }
    setDynamicOptions(newOptions);
  };

  useEffect(() => {
    fetchData();
    fetchDynamicOptions();
  }, [config.apiPath]);

  const handleOpenModal = (item?: any) => {
    if (item) {
      setEditId(item.id);
      setFormData({ ...item });
    } else {
      setEditId(null);
      const defaultState: Record<string, any> = { isActive: true };
      config.columns.forEach(c => {
        if (c.type === "boolean") defaultState[c.key] = false;
        else if (c.type === "select") defaultState[c.key] = "";
        else defaultState[c.key] = "";
      });
      setFormData(defaultState);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editId ? `${config.apiPath}/${editId}` : config.apiPath;
    const method = editId ? "PATCH" : "POST";

    // Transform data based on types
    const payload = { ...formData };
    config.columns.forEach(col => {
        if (col.type === "number" && payload[col.key]) {
            payload[col.key] = Number(payload[col.key]);
        }
    });

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        console.error(`[MasterDataEntityTab] Save failed: ${method} ${url} ${res.status}`, err);
        alert(`Save failed: ${err.error || res.statusText || "Unknown error"}`);
      }
    } catch (error: any) {
      console.error(`[MasterDataEntityTab] Network error: ${method} ${url}`, error);
      alert(`Save failed: Network error - ${error.message}`);
    }
  };

  const handleToggleStatus = async (item: any) => {
    if (!confirm(`Are you sure you want to ${item.isActive ? 'deactivate' : 'activate'} this record?`)) return;
    
    const url = `${config.apiPath}/${item.id}`;
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json().catch(() => ({}));
        console.error(`[MasterDataEntityTab] Toggle status failed: PATCH ${url} ${res.status}`, err);
        alert(`Action failed: ${err.error || res.statusText}`);
      }
    } catch (e: any) {
      console.error(`[MasterDataEntityTab] Toggle status network error: PATCH ${url}`, e);
      alert(`Action failed: Network error - ${e.message}`);
    }
  };

  const filteredData = data.filter(item => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    // Search across all string columns
    return config.columns.some(col => {
        const val = item[col.key];
        return val && typeof val === "string" && val.toLowerCase().includes(q);
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <config.icon className="h-6 w-6 text-indigo-500" />
            {config.label}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage all {config.label.toLowerCase()} entries in the master data hub.</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none w-64 transition-all"
            />
          </div>
          <Button onClick={() => handleOpenModal()} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add New
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                {config.columns.map(col => (
                  <th key={col.key} className="px-6 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">{col.label}</th>
                ))}
                <th className="px-6 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider text-center">Status</th>
                <th className="px-6 py-3 font-semibold text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={config.columns.length + 2} className="p-8 text-center text-gray-500">Loading...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={config.columns.length + 2} className="p-8 text-center text-gray-500">No records found.</td></tr>
              ) : (
                filteredData.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors">
                    {config.columns.map(col => (
                      <td key={col.key} className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-200">
                        {col.type === "boolean" ? (
                          item[col.key] ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <X className="h-4 w-4 text-red-500" />
                        ) : col.type === "select" && col.optionLabel && item[col.key.replace("Id", "")] ? (
                          // If it's a relation like companyId, the backend sends the joined \`company\` object.
                          String(item[col.key.replace("Id", "")][col.optionLabel])
                        ) : (
                          String(item[col.key] || "-")
                        )}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-center">
                      <Badge variant={item.isActive ? "success" : "neutral"} className="rounded-full px-2.5 py-0.5 text-xs font-medium">
                        {item.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleOpenModal(item)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleToggleStatus(item)} className={`p-1.5 rounded-md transition-colors ${item.isActive ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}>
                          <PowerOff className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editId ? `Edit ${config.label} Record` : `New ${config.label} Record`}>
        <form onSubmit={handleSave} className="space-y-4">
          {config.columns.map(col => (
            <div key={col.key} className="space-y-1">
              {col.type === "boolean" ? (
                <label className="flex items-center gap-2 cursor-pointer font-medium text-sm text-gray-700 dark:text-gray-300 mt-4">
                  <input
                    type="checkbox"
                    checked={formData[col.key] || false}
                    onChange={(e) => setFormData({ ...formData, [col.key]: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                  />
                  {col.label}
                </label>
              ) : col.type === "select" ? (
                <>
                  <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{col.label} {col.required && "*"}</label>
                  <select
                    value={formData[col.key] || ""}
                    onChange={(e) => setFormData({ ...formData, [col.key]: e.target.value })}
                    required={col.required}
                    className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                  >
                    <option value="">Select {col.label}</option>
                    {col.optionsApi ? (
                      dynamicOptions[col.key]?.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt[col.optionLabel || "name"]}</option>
                      ))
                    ) : (
                      col.options?.map(opt => (
                        <option key={opt.id} value={opt.id}>{opt.label}</option>
                      ))
                    )}
                  </select>
                </>
              ) : (
                <Input
                  label={col.label}
                  type={col.type || "text"}
                  value={formData[col.key] || ""}
                  onChange={(e) => setFormData({ ...formData, [col.key]: e.target.value })}
                  required={col.required}
                />
              )}
            </div>
          ))}

          <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-100 dark:border-gray-800">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Record</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
