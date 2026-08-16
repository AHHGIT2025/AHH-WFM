"use client";

import React, { useState, useEffect } from "react";
import { Card, Button, Input } from "@ahh-wfm/ui/src";
import { useRouter } from "next/navigation";

export default function ClearanceTemplates() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  
  // Selection
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  
  // Local edit states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [clearanceType, setClearanceType] = useState("LEAVE_VACATION");
  const [sections, setSections] = useState<any[]>([]);
  
  // Loading & statuses
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Fetch templates
  const fetchTemplates = async (selectId?: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/clearance/templates");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setTemplates(data.data);
        
        // Auto-select template
        if (data.data.length > 0) {
          const targetId = selectId || data.data[0].id;
          setSelectedTemplateId(targetId);
          loadTemplateDetail(targetId, data.data);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const loadTemplateDetail = (templateId: string, currentTemplates?: any[]) => {
    const list = currentTemplates || templates;
    const t = list.find(item => item.id === templateId);
    if (t) {
      setSelectedTemplate(t);
      setName(t.name);
      setDescription(t.description || "");
      setClearanceType(t.clearanceType);
      setSections(t.sections || []);
    }
  };

  const handleTemplateSelection = (id: string) => {
    setSelectedTemplateId(id);
    loadTemplateDetail(id);
    setMessage({ text: "", type: "" });
  };

  const handleSectionFieldChange = (index: number, field: string, value: any) => {
    const updated = [...sections];
    updated[index][field] = value;
    setSections(updated);
  };

  const handleAddSection = () => {
    const newSec = {
      sectionName: "New Department / Section",
      stepOrder: sections.length + 1,
      isRequiredByDefault: true,
      isExecutive: false,
      conditionalRule: ""
    };
    setSections([...sections, newSec]);
  };

  const handleRemoveSection = (index: number) => {
    const filtered = sections.filter((_, idx) => idx !== index).map((s, idx) => ({
      ...s,
      stepOrder: idx + 1
    }));
    setSections(filtered);
  };

  const handleSaveTemplate = async () => {
    if (!name.trim()) {
      setMessage({ text: "Template Name is required.", type: "error" });
      return;
    }

    setSaving(true);
    setMessage({ text: "", type: "" });

    try {
      const payload = {
        name,
        description,
        clearanceType,
        sections: sections.map(sec => ({
          sectionName: sec.sectionName,
          stepOrder: sec.stepOrder,
          isRequiredByDefault: sec.isRequiredByDefault,
          isExecutive: sec.isExecutive,
          conditionalRule: sec.conditionalRule || null
        }))
      };

      const res = await fetch(`/api/v1/clearance/templates/${selectedTemplateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const resData = await res.json();
      if (resData.success) {
        setMessage({ text: "Clearance template saved successfully!", type: "success" });
        await fetchTemplates(selectedTemplateId);
      } else {
        setMessage({ text: resData.error || "Failed to update template.", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: "An unexpected network error occurred.", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-[#FAF8F5] min-h-screen text-gray-800">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-4 border-gray-200">
        <div>
          <h1 className="text-3xl font-extrabold text-[#800000] tracking-tight">Clearance Operational Section Builder</h1>
          <p className="text-gray-500 mt-1">Configure operational checklist sections, department scopes, and conditional requirements for employee exits</p>
        </div>
        <Button variant="primary" className="bg-[#800000] text-white" onClick={() => router.push("/clearance")}>
          Back to Clearance Dashboard
        </Button>
      </div>

      {message.text && (
        <div className={`p-4 rounded shadow-sm font-semibold text-sm ${message.type === "success" ? "bg-green-50 border-l-4 border-green-500 text-green-800" : "bg-red-50 border-l-4 border-red-500 text-red-800"}`}>
          {message.type === "success" ? "✓" : "⚠️"} {message.text}
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading template details...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Templates list panel */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="p-4 bg-white border border-gray-200 shadow-sm">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Available Templates</h2>
              <div className="space-y-2">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateSelection(t.id)}
                    className={`w-full text-left p-3 rounded-lg border text-sm font-bold transition-all ${selectedTemplateId === t.id ? "bg-[#800000] text-white border-[#800000] shadow-sm" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
                  >
                    <div>{t.name}</div>
                    <div className={`text-[10px] mt-1 uppercase tracking-wider ${selectedTemplateId === t.id ? "text-[#D4AF37]" : "text-gray-400"}`}>
                      {t.clearanceType === "LEAVE_VACATION" ? "Leave / Vacation" : "Separation"}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          {/* Active Template Editor */}
          <div className="lg:col-span-3">
            {selectedTemplate && (
              <Card className="p-6 bg-white border border-gray-200 shadow-sm space-y-6">
                
                {/* Template Header Fields */}
                <div className="border-b pb-4 space-y-4">
                  <h2 className="text-xl font-extrabold text-[#800000] flex justify-between items-center">
                    <span>Configure Operational Sections</span>
                    <span className="text-xs uppercase tracking-wider font-bold bg-[#800000]/10 text-[#800000] py-1 px-3.5 rounded-full">
                      {clearanceType === "LEAVE_VACATION" ? "Leave / Vacation" : "Separation"}
                    </span>
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase">Template Name</label>
                      <Input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full text-sm border mt-1 py-1"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase">Clearance Type Mapping</label>
                      <select
                        value={clearanceType}
                        onChange={(e) => setClearanceType(e.target.value)}
                        className="w-full rounded border border-gray-300 text-sm py-2 px-3 mt-1 bg-white"
                      >
                        <option value="LEAVE_VACATION">Leave / Vacation Clearance</option>
                        <option value="SEPARATION">Separation Clearance</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 uppercase">Description</label>
                      <Input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe the operational scope for this clearance flow..."
                        className="w-full text-sm border mt-1 py-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Template Sections/Steps List */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b pb-2">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Operational Sections & Checklist Scope</h3>
                    <Button onClick={handleAddSection} className="bg-white border text-xs text-[#800000] hover:bg-[#800000]/5 py-1.5 px-3 font-semibold">
                      + Add New Section
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {sections.map((sec, idx) => (
                      <div key={idx} className="p-4 border border-gray-200 rounded-lg bg-gray-50/50 relative">
                        
                        {/* Remove Step button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveSection(idx)}
                          className="absolute right-4 top-4 text-xs font-semibold text-red-500 hover:text-red-700 hover:underline"
                        >
                          Delete Section
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                          
                          {/* Order & Step Name */}
                          <div className="md:col-span-1 flex items-center justify-center">
                            <span className="w-8 h-8 rounded-full bg-[#800000]/10 text-[#800000] flex items-center justify-center font-bold text-sm">
                              {sec.stepOrder}
                            </span>
                          </div>

                          <div className="md:col-span-5">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Section / Department Name</label>
                            <Input
                              type="text"
                              value={sec.sectionName}
                              onChange={(e) => handleSectionFieldChange(idx, "sectionName", e.target.value)}
                              className="w-full text-xs mt-1 border border-gray-300 py-1"
                            />
                          </div>

                          <div className="md:col-span-3 flex items-center gap-2 pt-4">
                            <input
                              type="checkbox"
                              id={`req-${idx}`}
                              checked={sec.isRequiredByDefault}
                              onChange={(e) => handleSectionFieldChange(idx, "isRequiredByDefault", e.target.checked)}
                              className="rounded text-[#800000] focus:ring-[#800000] h-4 w-4 border-gray-300"
                            />
                            <label htmlFor={`req-${idx}`} className="text-xs text-gray-600 font-semibold select-none cursor-pointer">
                              Required by Default
                            </label>
                          </div>

                          <div className="md:col-span-3 flex items-center gap-2 pt-4">
                            <input
                              type="checkbox"
                              id={`exec-${idx}`}
                              checked={sec.isExecutive}
                              onChange={(e) => handleSectionFieldChange(idx, "isExecutive", e.target.checked)}
                              className="rounded text-[#800000] focus:ring-[#800000] h-4 w-4 border-gray-300"
                            />
                            <label htmlFor={`exec-${idx}`} className="text-xs text-gray-600 font-semibold select-none cursor-pointer">
                              Executive Sign-off Section
                            </label>
                          </div>

                          <div className="md:col-span-1"></div>
                          
                          <div className="md:col-span-11">
                            <label className="block text-[10px] font-bold text-gray-500 uppercase">Applicability Condition Rule</label>
                            <Input
                              type="text"
                              value={sec.conditionalRule || ""}
                              onChange={(e) => handleSectionFieldChange(idx, "conditionalRule", e.target.value)}
                              placeholder="e.g., HAS_ACCOMMODATION, HAS_IT_ASSETS"
                              className="w-full text-xs mt-1 border border-gray-300 py-1"
                            />
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer Save actions */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
                  <Button
                    onClick={handleSaveTemplate}
                    disabled={saving}
                    className="bg-[#800000] text-white hover:bg-[#600000] px-6 py-2.5 text-sm font-bold shadow-md"
                  >
                    {saving ? "Saving Changes..." : "Save Operational Sections"}
                  </Button>
                </div>

              </Card>
            )}
          </div>

        </div>
      )}

    </div>
  );
}