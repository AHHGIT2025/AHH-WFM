"use client";

import { useState } from "react";
import { Building2, Users, Briefcase, MapPin, Map, Factory, Layers, Network, BookOpen, UserCheck, Key, LocateFixed, NetworkIcon, Globe, CircleDot } from "lucide-react";
import { MasterDataEntityTab } from "@/components/master-data/MasterDataEntityTab";

const MASTER_TABS = [
  { id: "companies", label: "Companies", icon: Building2, apiPath: "/api/v1/masters/companies", columns: [
    { key: "companyCode", label: "Code", required: true },
    { key: "companyName", label: "Company Name", required: true }
  ]},
  { id: "departments", label: "Departments", icon: Layers, apiPath: "/api/v1/masters/departments", columns: [
    { key: "companyId", label: "Company", type: "select", optionsApi: "/api/v1/masters/companies", optionLabel: "companyName" },
    { key: "name", label: "Department Name", required: true }
  ]},
  { id: "designations", label: "Designations", icon: Briefcase, apiPath: "/api/v1/masters/designations", columns: [
    { key: "code", label: "Code", required: true },
    { key: "name", label: "Title", required: true },
    { key: "workerCategory", label: "Category", type: "select", options: [{id:"WHITE_COLLAR", label:"White Collar"}, {id:"BLUE_COLLAR", label:"Blue Collar"}, {id:"BOTH", label:"Both"}] },
    { key: "isSupervisorPosition", label: "Is Supervisor", type: "boolean" },
    { key: "isRelieverEligible", label: "Reliever Eligible", type: "boolean" }
  ]},
  { id: "trades", label: "Trade Classifications", icon: Factory, apiPath: "/api/v1/masters/trades", columns: [
    { key: "code", label: "Code", required: true },
    { key: "name", label: "Trade Name", required: true },
    { key: "description", label: "Description" }
  ]},
  { id: "locations", label: "Locations", icon: Map, apiPath: "/api/v1/masters/locations", columns: [
    { key: "companyId", label: "Company", type: "select", optionsApi: "/api/v1/masters/companies", optionLabel: "companyName" },
    { key: "locationCode", label: "Code", required: true },
    { key: "locationName", label: "Location Name", required: true },
    { key: "latitude", label: "Latitude", type: "number" },
    { key: "longitude", label: "Longitude", type: "number" },
    { key: "defaultGeofenceRadiusMeters", label: "Geofence Radius (m)", type: "number" }
  ]},
  { id: "cost-centers", label: "Cost Centers", icon: BookOpen, apiPath: "/api/v1/masters/cost-centers", columns: [
    { key: "companyId", label: "Company", type: "select", optionsApi: "/api/v1/masters/companies", optionLabel: "companyName" },
    { key: "costCenterCode", label: "Code", required: true },
    { key: "costCenterName", label: "Name", required: true },
    { key: "sapCostCenterCode", label: "SAP Code" }
  ]},
  { id: "projects", label: "Projects", icon: Globe, apiPath: "/api/v1/masters/projects", columns: [
    { key: "companyId", label: "Company", type: "select", optionsApi: "/api/v1/masters/companies", optionLabel: "companyName" },
    { key: "projectCode", label: "Code", required: true },
    { key: "projectName", label: "Name", required: true },
    { key: "projectType", label: "Type", type: "select", options: [{id:"NORMAL", label:"Normal"}, {id:"ON_CALL", label:"On-Call"}] },
    { key: "locationId", label: "Location", type: "select", optionsApi: "/api/v1/masters/locations", optionLabel: "locationName" }
  ]},
  { id: "sites", label: "Project Sites", icon: LocateFixed, apiPath: "/api/v1/masters/sites", columns: [
    { key: "projectId", label: "Project", type: "select", optionsApi: "/api/v1/masters/projects", optionLabel: "projectName", required: true },
    { key: "siteCode", label: "Site Code", required: true },
    { key: "siteName", label: "Site Name", required: true },
    { key: "latitude", label: "Latitude", type: "number" },
    { key: "longitude", label: "Longitude", type: "number" },
    { key: "geofenceRadiusMeters", label: "Geofence Radius (m)", type: "number" }
  ]},
  { id: "punch-locations", label: "Allowed Punch Locations", icon: CircleDot, apiPath: "/api/v1/masters/punch-locations", columns: [
    { key: "companyId", label: "Company", type: "select", optionsApi: "/api/v1/masters/companies", optionLabel: "companyName", required: true },
    { key: "name", label: "Location Name", required: true },
    { key: "locationType", label: "Type", type: "select", required: true, options: [{id:"OFFICE", label:"Office"}, {id:"PROJECT_SITE", label:"Project Site"}, {id:"CUSTOM", label:"Custom"}, {id:"ON_CALL", label:"On-Call Client"}] },
    { key: "latitude", label: "Latitude", type: "number", required: true },
    { key: "longitude", label: "Longitude", type: "number", required: true },
    { key: "radiusMeters", label: "Radius (m)", type: "number", required: true }
  ]},
  { id: "standby-rules", label: "Standby Rules", icon: NetworkIcon, apiPath: "/api/v1/masters/standby-rules", columns: [
    { key: "ruleName", label: "Rule Name", required: true },
    { key: "designationId", label: "Designation", type: "select", optionsApi: "/api/v1/masters/designations", optionLabel: "name" },
    { key: "tradeClassificationId", label: "Trade", type: "select", optionsApi: "/api/v1/masters/trades", optionLabel: "name" },
    { key: "standbyRequired", label: "Standby Reqd", type: "boolean" },
    { key: "relieverRequiredForLeave", label: "Reliever Reqd (Leave)", type: "boolean" },
    { key: "relieverRequiredForOff", label: "Reliever Reqd (Off)", type: "boolean" }
  ]}
];

export default function MasterDataHubPage() {
  const [activeTab, setActiveTab] = useState(MASTER_TABS[0].id);

  const activeTabConfig = MASTER_TABS.find(t => t.id === activeTab) || MASTER_TABS[0];

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50 dark:bg-gray-900 overflow-hidden -m-6">
      {/* Sidebar Navigation */}
      <div className="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col shadow-sm z-10">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-br from-indigo-50 to-white dark:from-gray-800 dark:to-gray-800">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Key className="h-5 w-5 text-indigo-600" />
            Master Data Hub
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Centralized management for foundational entity data across the organization.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {MASTER_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'}`}
              >
                <tab.icon className={`h-4 w-4 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-gray-900/50 p-8">
        <div className="max-w-6xl mx-auto">
          <MasterDataEntityTab config={activeTabConfig as any} />
        </div>
      </div>
    </div>
  );
}
