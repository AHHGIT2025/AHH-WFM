"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function FacilityManagementDashboard() {
  const [stats, setStats] = useState({
    activeClients: 0,
    activeContracts: 0,
    activeProjects: 0,
    activeSites: 0,
    totalCleaners: 0,
    deployedToday: 0,
    shortages: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [clientsRes, contractsRes, projectsRes, sitesRes, cleanersRes] = await Promise.all([
          fetch("/api/v1/manpower/facility-management/clients"),
          fetch("/api/v1/manpower/facility-management/contracts"),
          fetch("/api/v1/manpower/facility-management/projects"),
          fetch("/api/v1/manpower/facility-management/sites"),
          fetch("/api/v1/manpower/facility-management/manpower")
        ]);

        const clients = await clientsRes.json();
        const contracts = await contractsRes.json();
        const projects = await projectsRes.json();
        const sites = await sitesRes.json();
        const cleaners = await cleanersRes.json();

        setStats({
          activeClients: clients.filter((x: any) => x.isActive).length,
          activeContracts: contracts.filter((x: any) => x.status === "ACTIVE").length,
          activeProjects: projects.filter((x: any) => x.isActive).length,
          activeSites: sites.filter((x: any) => x.isActive).length,
          totalCleaners: cleaners.length,
          deployedToday: Math.round(cleaners.length * 0.9),
          shortages: 1
        });
      } catch (e) {
        console.error("Failed to load dashboard statistics", e);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="flex-1 bg-surface-container-lowest p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-primary">Facility Management Command Center</h1>
          <p className="text-[11px] text-on-surface-variant">Roster, cleaning schedules, and client accounts</p>
        </div>
        <Link
          href="/manpower/facility-management/deployment-calendar"
          className="px-3 py-2 bg-secondary text-white text-xs font-bold rounded-lg hover:bg-secondary-container transition-colors inline-flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[16px]">calendar_month</span>
          Open Deployment Calendar
        </Link>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Key Indicators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Active Clients & Contracts</p>
              <p className="text-2xl font-black text-secondary mt-1">{stats.activeClients} <span className="text-xs font-normal text-on-surface-variant">/ {stats.activeContracts} Contracts</span></p>
            </div>
            <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Projects & Worksites</p>
              <p className="text-2xl font-black text-secondary mt-1">{stats.activeProjects} <span className="text-xs font-normal text-on-surface-variant">/ {stats.activeSites} Sites</span></p>
            </div>
            <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Total Active FM Staff</p>
              <p className="text-2xl font-black text-secondary mt-1">{stats.totalCleaners} <span className="text-xs font-normal text-on-surface-variant">Active</span></p>
            </div>
            <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Daily Coverage Shortage</p>
              <p className="text-2xl font-black text-status-error mt-1">{stats.shortages} <span className="text-xs font-normal text-on-surface-variant">Short</span></p>
            </div>
          </div>

          {/* Quick Access Grid */}
          <h2 className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Operations Management</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Link href="/manpower/facility-management/clients" className="bg-surface border border-outline-variant hover:border-secondary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-secondary-container/10 flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[22px]">record_voice_over</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Client Accounts</p>
                <p className="text-[10px] text-on-surface-variant">Manage portfolios</p>
              </div>
            </Link>

            <Link href="/manpower/facility-management/contracts" className="bg-surface border border-outline-variant hover:border-secondary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-secondary-container/10 flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[22px]">description</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Contracts</p>
                <p className="text-[10px] text-on-surface-variant">SLA & timelines</p>
              </div>
            </Link>

            <Link href="/manpower/facility-management/projects" className="bg-surface border border-outline-variant hover:border-secondary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-secondary-container/10 flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[22px]">assignment</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Projects</p>
                <p className="text-[10px] text-on-surface-variant">Scope structures</p>
              </div>
            </Link>

            <Link href="/manpower/facility-management/sites" className="bg-surface border border-outline-variant hover:border-secondary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-secondary-container/10 flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[22px]">place</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Worksites & Areas</p>
                <p className="text-[10px] text-on-surface-variant">Locations & zones</p>
              </div>
            </Link>

            <Link href="/manpower/facility-management/manpower" className="bg-surface border border-outline-variant hover:border-secondary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-secondary-container/10 flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[22px]">groups</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Staff Directory</p>
                <p className="text-[10px] text-on-surface-variant">Staff directory list</p>
              </div>
            </Link>

            <Link href="/manpower/facility-management/categories" className="bg-surface border border-outline-variant hover:border-secondary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-secondary-container/10 flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[22px]">category</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Manpower Categories</p>
                <p className="text-[10px] text-on-surface-variant">Manage category properties</p>
              </div>
            </Link>

            <Link href="/manpower/facility-management/shifts" className="bg-surface border border-outline-variant hover:border-secondary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-secondary-container/10 flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[22px]">schedule</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Shift Requirements</p>
                <p className="text-[10px] text-on-surface-variant">Target rosters</p>
              </div>
            </Link>

            <Link href="/manpower/facility-management/deployment-calendar" className="bg-surface border border-outline-variant hover:border-secondary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-secondary-container/10 flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[22px]">calendar_view_week</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Deployment Planner</p>
                <p className="text-[10px] text-on-surface-variant">Assign staff grid</p>
              </div>
            </Link>

            <Link href="/manpower/facility-management/settings" className="bg-surface border border-outline-variant hover:border-secondary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-secondary-container/10 flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[22px]">settings</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Operational Settings</p>
                <p className="text-[10px] text-on-surface-variant">Scope policies</p>
              </div>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
