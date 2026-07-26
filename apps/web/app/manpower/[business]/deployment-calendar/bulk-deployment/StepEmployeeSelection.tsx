"use client";

import React, { useState, useMemo } from "react";
import { Search, CheckSquare, Square, ArrowRight, ArrowLeft } from "lucide-react";

export interface EmployeeItem {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  operationType: string;
  tradePosition: string;
  categoryName?: string;
  isActive: boolean;
}

interface StepEmployeeSelectionProps {
  availableEmployees: EmployeeItem[];
  selectedEmployeeIds: string[];
  setSelectedEmployeeIds: (ids: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const StepEmployeeSelection: React.FC<StepEmployeeSelectionProps> = ({
  availableEmployees,
  selectedEmployeeIds,
  setSelectedEmployeeIds,
  onNext,
  onBack
}) => {
  const [search, setSearch] = useState("");

  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return availableEmployees;
    const q = search.toLowerCase();
    return availableEmployees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.tradePosition.toLowerCase().includes(q)
    );
  }, [availableEmployees, search]);

  const isAllFilteredSelected = filteredEmployees.length > 0 && filteredEmployees.every((e) => selectedEmployeeIds.includes(e.id));

  const toggleAllFiltered = () => {
    if (isAllFilteredSelected) {
      const filteredIds = new Set(filteredEmployees.map((e) => e.id));
      setSelectedEmployeeIds(selectedEmployeeIds.filter((id) => !filteredIds.has(id)));
    } else {
      const newIds = new Set([...selectedEmployeeIds, ...filteredEmployees.map((e) => e.id)]);
      setSelectedEmployeeIds(Array.from(newIds));
    }
  };

  const toggleEmployee = (id: string) => {
    if (selectedEmployeeIds.includes(id)) {
      setSelectedEmployeeIds(selectedEmployeeIds.filter((item) => item !== id));
    } else {
      setSelectedEmployeeIds([...selectedEmployeeIds, id]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-base font-bold text-foreground">Step 3 — Select Manpower</h4>
          <p className="text-xs text-secondary mt-1">
            Search and select guards or manpower employees to deploy.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleAllFiltered}
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
        >
          {isAllFilteredSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          {isAllFilteredSelected ? "Deselect Filtered" : "Select Filtered"}
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-secondary" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, employee ID, or trade/position..."
          className="w-full bg-background border border-outline rounded-xl h-10 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* List */}
      <div className="max-h-72 overflow-y-auto space-y-2 border border-outline-variant rounded-xl p-3 bg-background">
        {filteredEmployees.length === 0 ? (
          <div className="p-8 text-center text-xs text-secondary">
            No matching active employees found.
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const isChecked = selectedEmployeeIds.includes(emp.id);

            return (
              <div
                key={emp.id}
                onClick={() => toggleEmployee(emp.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all flex items-center justify-between ${
                  isChecked
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-outline hover:border-primary/40 bg-surface"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-primary">
                    {isChecked ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5 text-secondary" />}
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-foreground">{emp.name}</h5>
                    <p className="text-xs text-secondary mt-0.5">{emp.id} • {emp.tradePosition}</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-success/10 text-success border border-success/20">
                  Active
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="border border-outline text-foreground font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-surface-variant flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          disabled={selectedEmployeeIds.length === 0}
          onClick={onNext}
          className="bg-primary text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Next: Map Employees ({selectedEmployeeIds.length}) <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
