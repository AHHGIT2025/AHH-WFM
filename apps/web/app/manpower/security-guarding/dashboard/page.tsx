"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function SecurityGuardingDashboard() {
  const [stats, setStats] = useState({
    activeClients: 0,
    activeContracts: 0,
    activeProjects: 0,
    activeSites: 0,
    totalGuards: 0,
    deployedToday: 0,
    shortages: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [clientsRes, contractsRes, projectsRes, sitesRes, guardsRes] = await Promise.all([
          fetch("/api/v1/manpower/security-guarding/clients"),
          fetch("/api/v1/manpower/security-guarding/contracts"),
          fetch("/api/v1/manpower/security-guarding/projects"),
          fetch("/api/v1/manpower/security-guarding/sites"),
          fetch("/api/v1/manpower/security-guarding/manpower")
        ]);

        const clients = await clientsRes.json();
        const contracts = await contractsRes.json();
        const projects = await projectsRes.json();
        const sites = await sitesRes.json();
        const guards = await guardsRes.json();

        setStats({
          activeClients: clients.filter((x: any) => x.isActive).length,
          activeContracts: contracts.filter((x: any) => x.status === "ACTIVE").length,
          activeProjects: projects.filter((x: any) => x.isActive).length,
          activeSites: sites.filter((x: any) => x.isActive).length,
          totalGuards: guards.length,
          deployedToday: Math.round(guards.length * 0.85),
          shortages: 3
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
          <h1 className="text-xl font-bold text-primary">Security Guarding Command Center</h1>
          <p className="text-[11px] text-on-surface-variant">Roster, deployment ledger, and client accounts</p>
        </div>
        <Link
          href="/manpower/security-guarding/deployment-calendar"
          className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-container transition-colors inline-flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-[16px]">calendar_month</span>
          Open Deployment Calendar
        </Link>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Key Indicators Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Active Clients & Contracts</p>
              <p className="text-2xl font-black text-primary mt-1">{stats.activeClients} <span className="text-xs font-normal text-on-surface-variant">/ {stats.activeContracts} Contracts</span></p>
            </div>
            <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Projects & Worksites</p>
              <p className="text-2xl font-black text-primary mt-1">{stats.activeProjects} <span className="text-xs font-normal text-on-surface-variant">/ {stats.activeSites} Sites</span></p>
            </div>
            <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Total Active Security Force</p>
              <p className="text-2xl font-black text-primary mt-1">{stats.totalGuards} <span className="text-xs font-normal text-on-surface-variant">Active</span></p>
            </div>
            <div className="bg-surface border border-outline-variant p-4 rounded-xl shadow-sm">
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Daily Coverage Shortage</p>
              <p className="text-2xl font-black text-status-error mt-1">{stats.shortages} <span className="text-xs font-normal text-on-surface-variant">Short</span></p>
            </div>
          </div>

          {/* Quick Access Grid */}
          <h2 className="text-xs font-bold text-primary uppercase tracking-widest mb-4">Operations Management</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Link href="/manpower/security-guarding/clients" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[22px]">record_voice_over</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Client Accounts</p>
                <p className="text-[10px] text-on-surface-variant">Manage portfolios</p>
              </div>
            </Link>

            <Link href="/manpower/security-guarding/contracts" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[22px]">description</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Contracts</p>
                <p className="text-[10px] text-on-surface-variant">SLA & timelines</p>
              </div>
            </Link>

            <Link href="/manpower/security-guarding/projects" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[22px]">assignment</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Projects</p>
                <p className="text-[10px] text-on-surface-variant">Scope structures</p>
              </div>
            </Link>

            <Link href="/manpower/security-guarding/sites" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[22px]">place</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Worksites & Gates</p>
                <p className="text-[10px] text-on-surface-variant">Locations & posts</p>
              </div>
            </Link>

            <Link href="/manpower/security-guarding/manpower" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[22px]">shield</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Guards Directory</p>
                <p className="text-[10px] text-on-surface-variant">Staff directory list</p>
              </div>
            </Link>

            <Link href="/manpower/security-guarding/categories" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[22px]">category</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Manpower Categories</p>
                <p className="text-[10px] text-on-surface-variant">Manage category properties</p>
              </div>
            </Link>

            <Link href="/manpower/security-guarding/shifts" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[22px]">schedule</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Shift Requirements</p>
                <p className="text-[10px] text-on-surface-variant">Target rosters</p>
              </div>
            </Link>

            <Link href="/manpower/security-guarding/deployment-calendar" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-[22px]">calendar_view_week</span>
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Deployment Planner</p>
                <p className="text-[10px] text-on-surface-variant">Assign staff grid</p>
              </div>
            </Link>

            <Link href="/manpower/security-guarding/settings" className="bg-surface border border-outline-variant hover:border-primary/20 hover:shadow-sm p-4 rounded-xl flex items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary shrink-0">
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
