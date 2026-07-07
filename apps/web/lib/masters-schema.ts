export interface MasterColumn {
  key: string;
  label: string;
  type?: "text" | "number" | "boolean" | "select";
  required?: boolean;
  options?: { id: string; label: string }[];
  optionsApi?: string;
  optionLabel?: string;
  referenceKey?: string; // used to map import values, e.g. companyCode -> companyId
  referenceEntity?: string;
}

export interface MasterSchema {
  id: string;
  label: string;
  apiPath: string;
  columns: MasterColumn[];
}

export const MASTER_SCHEMAS: Record<string, MasterSchema> = {
  companies: {
    id: "companies",
    label: "Companies",
    apiPath: "/api/v1/masters/companies",
    columns: [
      { key: "companyCode", label: "Code", required: true },
      { key: "companyName", label: "Company Name", required: true }
    ]
  },
  departments: {
    id: "departments",
    label: "Departments",
    apiPath: "/api/v1/masters/departments",
    columns: [
      { key: "companyId", label: "Company", type: "select", optionsApi: "/api/v1/masters/companies", optionLabel: "companyName", referenceKey: "companyCode", referenceEntity: "companies" },
      { key: "name", label: "Department Name", required: true }
    ]
  },
  designations: {
    id: "designations",
    label: "Designations",
    apiPath: "/api/v1/masters/designations",
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "name", label: "Title", required: true },
      { key: "employeeCategory", label: "Category", type: "select", options: [{ id: "WHITE_COLLAR", label: "White Collar" }, { id: "BLUE_COLLAR", label: "Blue Collar" }, { id: "BOTH", label: "Both" }] },
      { key: "isSupervisorPosition", label: "Is Supervisor", type: "boolean" },
      { key: "isRelieverEligible", label: "Reliever Eligible", type: "boolean" }
    ]
  },
  "trade-classifications": {
    id: "trade-classifications",
    label: "Trade Classifications",
    apiPath: "/api/v1/masters/trade-classifications",
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "name", label: "Trade Name", required: true },
      { key: "description", label: "Description" }
    ]
  },
  locations: {
    id: "locations",
    label: "Locations",
    apiPath: "/api/v1/masters/locations",
    columns: [
      { key: "companyId", label: "Company", type: "select", optionsApi: "/api/v1/masters/companies", optionLabel: "companyName", referenceKey: "companyCode", referenceEntity: "companies" },
      { key: "locationCode", label: "Code", required: true },
      { key: "locationName", label: "Location Name", required: true },
      { key: "latitude", label: "Latitude", type: "number" },
      { key: "longitude", label: "Longitude", type: "number" },
      { key: "defaultGeofenceRadiusMeters", label: "Geofence Radius (m)", type: "number" }
    ]
  },
  "cost-centers": {
    id: "cost-centers",
    label: "Cost Centers",
    apiPath: "/api/v1/masters/cost-centers",
    columns: [
      { key: "companyId", label: "Company", type: "select", optionsApi: "/api/v1/masters/companies", optionLabel: "companyName", referenceKey: "companyCode", referenceEntity: "companies" },
      { key: "costCenterCode", label: "Code", required: true },
      { key: "costCenterName", label: "Name", required: true },
      { key: "sapCostCenterCode", label: "SAP Code" }
    ]
  },
  projects: {
    id: "projects",
    label: "Projects",
    apiPath: "/api/v1/masters/projects",
    columns: [
      { key: "companyId", label: "Company", type: "select", optionsApi: "/api/v1/masters/companies", optionLabel: "companyName", referenceKey: "companyCode", referenceEntity: "companies" },
      { key: "projectCode", label: "Code", required: true },
      { key: "projectName", label: "Name", required: true },
      { key: "projectType", label: "Type", type: "select", options: [{ id: "NORMAL", label: "Normal" }, { id: "ON_CALL", label: "On-Call" }] },
      { key: "locationId", label: "Location", type: "select", optionsApi: "/api/v1/masters/locations", optionLabel: "locationName", referenceKey: "locationCode", referenceEntity: "locations" }
    ]
  },
  "project-sites": {
    id: "project-sites",
    label: "Project Sites",
    apiPath: "/api/v1/masters/project-sites",
    columns: [
      { key: "projectId", label: "Project", type: "select", optionsApi: "/api/v1/masters/projects", optionLabel: "projectName", required: true, referenceKey: "projectCode", referenceEntity: "projects" },
      { key: "siteCode", label: "Site Code", required: true },
      { key: "siteName", label: "Site Name", required: true },
      { key: "latitude", label: "Latitude", type: "number" },
      { key: "longitude", label: "Longitude", type: "number" },
      { key: "geofenceRadiusMeters", label: "Geofence Radius (m)", type: "number" }
    ]
  },
  "allowed-punch-locations": {
    id: "allowed-punch-locations",
    label: "Allowed Punch Locations",
    apiPath: "/api/v1/masters/allowed-punch-locations",
    columns: [
      { key: "companyId", label: "Company", type: "select", optionsApi: "/api/v1/masters/companies", optionLabel: "companyName", required: true, referenceKey: "companyCode", referenceEntity: "companies" },
      { key: "name", label: "Location Name", required: true },
      { key: "locationType", label: "Type", type: "select", required: true, options: [{ id: "OFFICE", label: "Office" }, { id: "PROJECT_SITE", label: "Project Site" }, { id: "CUSTOM", label: "Custom" }, { id: "ON_CALL", label: "On-Call Client" }] },
      { key: "latitude", label: "Latitude", type: "number", required: true },
      { key: "longitude", label: "Longitude", type: "number", required: true },
      { key: "radiusMeters", label: "Radius (m)", type: "number", required: true }
    ]
  },
  "standby-rules": {
    id: "standby-rules",
    label: "Standby Rules",
    apiPath: "/api/v1/masters/standby-rules",
    columns: [
      { key: "ruleName", label: "Rule Name", required: true },
      { key: "designationId", label: "Designation", type: "select", optionsApi: "/api/v1/masters/designations", optionLabel: "name", referenceKey: "designationCode", referenceEntity: "designations" },
      { key: "tradeClassificationId", label: "Trade", type: "select", optionsApi: "/api/v1/masters/trades", optionLabel: "name", referenceKey: "tradeCode", referenceEntity: "trade-classifications" },
      { key: "standbyRequired", label: "Standby Reqd", type: "boolean" },
      { key: "relieverRequiredForLeave", label: "Reliever Reqd (Leave)", type: "boolean" },
      { key: "relieverRequiredForOff", label: "Reliever Reqd (Off)", type: "boolean" }
    ]
  },
  "leave-types": {
    id: "leave-types",
    label: "Leave Types",
    apiPath: "/api/v1/masters/leave-types",
    columns: [
      { key: "code", label: "Code", required: true },
      { key: "name", label: "Leave Type Name", required: true },
      { key: "description", label: "Description" },
      { key: "isPaid", label: "Is Paid", type: "boolean" },
      { key: "requiresDocument", label: "Requires Document", type: "boolean" },
      { key: "workflowCode", label: "Workflow Code" },
      { key: "defaultAnnualAllocation", label: "Default Allocation (Days)", type: "number" },
      { key: "maxDaysPerRequest", label: "Max Days/Request", type: "number" },
      { key: "allowHalfDay", label: "Allow Half Day", type: "boolean" },
      { key: "allowCarryForward", label: "Allow Carry Forward", type: "boolean" },
      { key: "carryForwardLimit", label: "Carry Forward Limit", type: "number" },
      { key: "genderRestriction", label: "Gender Restriction", type: "select", options: [{ id: "ALL", label: "All Genders" }, { id: "MALE", label: "Male Only" }, { id: "FEMALE", label: "Female Only" }] },
      { key: "applicableAfterProbation", label: "Applies After Probation", type: "boolean" }
    ]
  }
};
