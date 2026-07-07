"use client";

import React, { useState, useEffect } from "react";
import { Plus, Search, Edit2, PowerOff, CheckCircle2, X, Trash2, Upload, AlertTriangle } from "lucide-react";
import { Card, Button, Input, Modal, Badge } from "@ahh-wfm/ui/src";
import { useSession } from "next-auth/react";
import { isAdminUser } from "@/lib/permissions";

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
  const { data: session } = useSession();
  const isAdmin = isAdminUser(session?.user as any);

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  
  // To hold dynamic options (like Companies list for a Select field)
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, any[]>>({});

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

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
      
      // Initialize with fallbacks for scalar relation IDs
      const initialForm = { ...item };
      initialForm.companyId = item.companyId || item.company?.id || "";
      initialForm.projectId = item.projectId || item.project?.id || "";
      initialForm.locationId = item.locationId || item.location?.id || "";
      initialForm.departmentId = item.departmentId || item.department?.id || "";
      initialForm.costCenterId = item.costCenterId || item.costCenter?.id || "";
      initialForm.siteId = item.siteId || item.site?.id || "";

      setFormData(initialForm);
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

    // Clean payload before sending
    const payload = { ...formData };
    
    // Remove nested relation objects
    const relationsToClean = ["company", "project", "location", "department", "costCenter", "site"];
    for (const rel of relationsToClean) {
      delete payload[rel];
    }

    config.columns.forEach(col => {
      if (col.type === "number" && payload[col.key] !== undefined && payload[col.key] !== null && payload[col.key] !== "") {
        payload[col.key] = Number(payload[col.key]);
      }
      // Convert select empty string values to null
      if (col.type === "select" && payload[col.key] === "") {
        payload[col.key] = null;
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

  const handleDelete = async (item: any) => {
    const confirmName = item.name || item.companyName || item.projectName || item.locationName || item.costCenterName || item.siteName || item.code || item.id || "";
    if (!confirm(`Are you sure you want to permanently delete "${confirmName}"?`)) return;

    try {
      const res = await fetch(`${config.apiPath}/${item.id}`, {
        method: "DELETE"
      });
      const resData = await res.json().catch(() => ({}));
      if (res.ok) {
        if (resData.deactivated) {
          alert(resData.message || "This master is already used in records. It has been deactivated instead of permanently deleted.");
        }
        fetchData();
      } else {
        alert(resData.error || "Failed to delete record.");
      }
    } catch (e: any) {
      console.error(`[MasterDataEntityTab] Delete network error: DELETE ${config.apiPath}/${item.id}`, e);
      alert(`Action failed: Network error - ${e.message}`);
    }
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportPreview(null);
    setImportStatus(null);
    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const csvText = event.target?.result as string;
        try {
          const res = await fetch(`${config.apiPath}/bulk-preview`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              csvText,
              fileName: file.name,
              updateExisting
            })
          });
          if (res.ok) {
            setImportPreview(await res.json());
          } else {
            const err = await res.json().catch(() => ({}));
            alert(err.error || "Failed to parse file preview.");
          }
        } catch (err: any) {
          alert("Error generating preview: " + err.message);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      alert("Failed to read file: " + err.message);
      setIsUploading(false);
    }
  };

  const handleCommitImport = async () => {
    if (!importPreview || !importPreview.previewRows) return;
    const validRows = importPreview.previewRows.filter((r: any) => r.isValid).map((r: any) => r.data);
    if (validRows.length === 0) {
      alert("No valid rows to import.");
      return;
    }

    setImportStatus("Importing records, please wait...");
    setIsUploading(true);

    try {
      const res = await fetch(`${config.apiPath}/bulk-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: validRows,
          fileName: importFile?.name || "import.csv",
          updateExisting
        })
      });
      if (res.ok) {
        const result = await res.json();
        setImportStatus(`Import successful! ${result.importedRows} records imported, ${result.updatedRows} records updated.`);
        fetchData();
        // Clear file and preview
        setImportFile(null);
        setImportPreview(null);
      } else {
        const err = await res.json().catch(() => ({}));
        setImportStatus(`Import failed: ${err.error || "Server error"}`);
      }
    } catch (err: any) {
      setImportStatus(`Import failed due to network error: ${err.message}`);
    } finally {
      setIsUploading(false);
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
          <Button onClick={() => {
            setImportFile(null);
            setImportPreview(null);
            setImportStatus(null);
            setIsImportModalOpen(true);
          }} variant="secondary" className="flex items-center gap-2">
            <Upload className="h-4 w-4" /> Bulk Import
          </Button>
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
                        ) : col.type === "select" && col.optionLabel ? (
                          (() => {
                            const relKey = col.key.replace("Id", "");
                            const relationObj = item[relKey];
                            if (relationObj) {
                              const code = relationObj.code || relationObj.companyCode || relationObj.projectCode || relationObj.locationCode || relationObj.costCenterCode || relationObj.siteCode || "";
                              const name = relationObj.name || relationObj.companyName || relationObj.projectName || relationObj.locationName || relationObj.costCenterName || relationObj.siteName || relationObj[col.optionLabel] || "";
                              if (code && name) return `${code} — ${name}`;
                              if (name) return name;
                              if (code) return code;
                              return String(relationObj[col.optionLabel] || "-");
                            }
                            const options = dynamicOptions[col.key] || [];
                            const matched = options.find((opt: any) => opt.id === item[col.key]);
                            if (matched) {
                              const code = matched.code || matched.companyCode || matched.projectCode || matched.locationCode || matched.costCenterCode || matched.siteCode || "";
                              const name = matched.name || matched.companyName || matched.projectName || matched.locationName || matched.costCenterName || matched.siteName || matched[col.optionLabel] || "";
                              if (code && name) return `${code} — ${name}`;
                              if (name) return name;
                              if (code) return code;
                              return String(matched[col.optionLabel] || "-");
                            }
                            return String(item[col.key] || "-");
                          })()
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
                        <button onClick={() => handleOpenModal(item)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors" title="Edit Record">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleToggleStatus(item)} className={`p-1.5 rounded-md transition-colors ${item.isActive ? "text-red-600 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`} title="Toggle Active Status">
                          <PowerOff className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button onClick={() => handleDelete(item)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete Record">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
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
                      dynamicOptions[col.key]?.map(opt => {
                        const code = opt.code || opt.companyCode || opt.projectCode || opt.locationCode || opt.costCenterCode || opt.siteCode || "";
                        const name = opt.name || opt.companyName || opt.projectName || opt.locationName || opt.costCenterName || opt.siteName || opt[col.optionLabel || "name"] || "";
                        const label = code && name ? `${code} — ${name}` : (name || code || opt.id);
                        return (
                          <option key={opt.id} value={opt.id}>{label}</option>
                        );
                      })
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

      {/* Master Bulk Import Modal */}
      <Modal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} title={`Bulk Import ${config.label} Gateway`}>
        <div className="space-y-4 text-xs font-semibold p-1">
          {/* Download Template Block */}
          <div className="p-4 bg-surface-container-low border border-border-subtle rounded-xl flex justify-between items-center">
            <div>
              <p className="font-bold text-primary text-[13px]">Download CSV Template</p>
              <p className="text-[10px] text-outline-variant font-medium">Standard schema fields layout rules template file.</p>
            </div>
            <a
              href={`${config.apiPath}/bulk-template`}
              download
              className="bg-primary text-white hover:bg-primary/95 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">download</span> Download CSV
            </a>
          </div>

          {/* Upload and settings block */}
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-primary">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                Update existing records if code/name matches
              </label>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-outline-variant">Upload CSV Data File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleImportFileChange}
                className="w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
            </div>
          </div>

          {/* Upload loading/status messages */}
          {isUploading && (
            <div className="p-3 bg-indigo-50 text-indigo-700 rounded-lg text-center animate-pulse">
              Processing data, please wait...
            </div>
          )}

          {importStatus && (
            <div className={`p-3 rounded-lg border text-center ${importStatus.includes("successful") ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
              {importStatus}
            </div>
          )}

          {/* Validation Statistics and Preview */}
          {importPreview && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
                  <p className="text-gray-500 font-bold">Total Rows</p>
                  <p className="text-[14px] font-black text-gray-800">{importPreview.totalRows}</p>
                </div>
                <div className="bg-green-50 p-2 rounded-lg border border-green-200">
                  <p className="text-green-600 font-bold">Valid Rows</p>
                  <p className="text-[14px] font-black text-green-700">{importPreview.validRows}</p>
                </div>
                <div className="bg-red-50 p-2 rounded-lg border border-red-200">
                  <p className="text-red-600 font-bold">Error Rows</p>
                  <p className="text-[14px] font-black text-red-700">{importPreview.invalidRows}</p>
                </div>
                <div className="bg-orange-50 p-2 rounded-lg border border-orange-200">
                  <p className="text-orange-600 font-bold">Importable</p>
                  <p className="text-[14px] font-black text-orange-700">{importPreview.validRows}</p>
                </div>
              </div>

              {/* Preview table/list */}
              <div className="border border-border-subtle rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-left border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-gray-100 border-b border-border-subtle sticky top-0">
                      <th className="p-2 w-12 text-center">Row</th>
                      <th className="p-2">Details</th>
                      <th className="p-2 w-16 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.previewRows.map((row: any, rIdx: number) => (
                      <tr key={rIdx} className={`border-b border-border-subtle ${row.isValid ? "bg-white" : "bg-red-50/30"}`}>
                        <td className="p-2 text-center text-outline-variant font-bold">{row.rowNum}</td>
                        <td className="p-2 space-y-1">
                          <div className="flex flex-wrap gap-2 text-on-surface-variant">
                            {Object.entries(row.data).slice(0, 3).map(([k, v]) => (
                              <span key={k} className="bg-gray-50 px-1 py-0.5 rounded border border-gray-100">
                                <strong>{k}:</strong> {String(v)}
                              </span>
                            ))}
                          </div>
                          {row.errors && row.errors.length > 0 && (
                            <div className="text-status-error font-medium flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              <span>{row.errors.join(", ")}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {row.isValid ? (
                            <span className="text-green-600 font-extrabold">PASS</span>
                          ) : (
                            <span className="text-red-600 font-extrabold">FAIL</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Commit Button */}
              {importPreview.validRows > 0 && (
                <div className="flex justify-end pt-2 border-t border-border-subtle">
                  <Button
                    onClick={handleCommitImport}
                    disabled={isUploading}
                    className="w-full sm:w-auto font-bold text-xs"
                    type="button"
                  >
                    Commit Import ({importPreview.validRows} rows)
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-border-subtle pt-4 mt-6">
            <Button variant="secondary" type="button" onClick={() => setIsImportModalOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
