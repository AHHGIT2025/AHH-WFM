"use client";

import React, { useState, useEffect } from "react";
import { Card, Badge, Input, Button, Modal } from "@ahh-wfm/ui/src";

export default function UserAccountsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Edit Auth Settings Modal
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [username, setUsername] = useState("");
  const [authMode, setAuthMode] = useState("LOCAL");
  const [isLoginEnabled, setIsLoginEnabled] = useState(true);

  // Password Reset Modal
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/admin/user-accounts");
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openEditModal = (u: any) => {
    setSelectedUser(u);
    setUsername(u.username || "");
    setAuthMode(u.authMode || "LOCAL");
    setIsLoginEnabled(u.isLoginEnabled !== false);
    setIsEditOpen(true);
  };

  const saveAuthSettings = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`/api/v1/admin/user-accounts/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, authMode, isLoginEnabled })
      });
      if (res.ok) {
        setIsEditOpen(false);
        fetchUsers();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to update settings");
      }
    } catch (e) {
      alert("Network error");
    }
  };

  const toggleLock = async (u: any) => {
    const action = u.isLocked ? "unlock" : "lock";
    if (!confirm(`Are you sure you want to ${action} ${u.name}'s account?`)) return;

    try {
      const res = await fetch(`/api/v1/admin/user-accounts/${u.id}/${action}`, { method: "POST" });
      if (res.ok) {
        fetchUsers();
      } else {
        alert(`Failed to ${action} account`);
      }
    } catch (e) {
      alert("Network error");
    }
  };

  const handlePasswordReset = async () => {
    if (!selectedUser) return;
    setResetError("");
    setResetSuccess("");
    if (newPassword.length < 8) {
      setResetError("Password must be at least 8 characters");
      return;
    }

    try {
      const res = await fetch(`/api/v1/admin/user-accounts/${selectedUser.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword })
      });
      if (res.ok) {
        setResetSuccess("Password reset successfully. User must change it upon next login.");
        setTimeout(() => {
          setIsResetOpen(false);
          setNewPassword("");
          setResetSuccess("");
        }, 2000);
      } else {
        const err = await res.json();
        setResetError(err.error || "Failed to reset password");
      }
    } catch (e) {
      setResetError("Network error");
    }
  };

  const handleResetFilters = () => {
    setSearch("");
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.username && u.username.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-primary">User Accounts & Auth Settings</h1>
          <p className="text-sm text-on-surface-variant">Manage application access, passwords, and security constraints</p>
        </div>
      </div>

      <Card className="p-4 flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
          <input
            className="pl-10 pr-4 py-2 border border-outline-variant rounded-lg bg-surface text-sm w-full focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            placeholder="Search by name, email, or username..."
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button 
          variant="secondary" 
          onClick={handleResetFilters}
          className="flex items-center gap-1.5 text-xs bg-surface border border-outline-variant"
        >
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">filter_alt_off</span>
          Reset Filters
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container-low border-b border-border-subtle">
              <tr>
                <th className="px-6 py-3 font-bold text-on-surface-variant">Employee</th>
                <th className="px-6 py-3 font-bold text-on-surface-variant">Auth Mode</th>
                <th className="px-6 py-3 font-bold text-on-surface-variant">Status</th>
                <th className="px-6 py-3 font-bold text-on-surface-variant">Security</th>
                <th className="px-6 py-3 font-bold text-on-surface-variant text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {filteredUsers.map(u => (
                <tr key={u.id} className="hover:bg-surface-container-lowest transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-primary">{u.name}</div>
                    <div className="text-xs text-on-surface-variant">{u.email}</div>
                    {u.username && <div className="text-xs font-mono mt-1 text-secondary">@{u.username}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={u.authMode === "SSO" ? "info" : u.authMode === "LOCAL_AND_SSO" ? "warning" : "neutral"}>
                      {u.authMode || "LOCAL"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      {u.isLoginEnabled !== false ? (
                        <Badge variant="success">Enabled</Badge>
                      ) : (
                        <Badge variant="error">Disabled</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start text-xs">
                      {u.isLocked && <Badge variant="error" className="flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">lock</span> Locked</Badge>}
                      {!u.isLocked && <span className="text-success flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">lock_open</span> Unlocked</span>}
                      {u.mustChangePassword && <span className="text-warning flex items-center gap-1 mt-1"><span className="material-symbols-outlined text-[14px]">key</span> Needs reset</span>}
                      <span className="text-on-surface-variant mt-1">Failed attempts: {u.failedLoginAttempts || 0}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => toggleLock(u)}>
                        {u.isLocked ? "Unlock" : "Lock"}
                      </Button>
                      <Button variant="secondary" className="px-2 py-1 text-xs" onClick={() => openEditModal(u)}>
                        Settings
                      </Button>
                      <Button variant="primary" className="px-2 py-1 text-xs" onClick={() => {
                        setSelectedUser(u);
                        setNewPassword("");
                        setResetError("");
                        setResetSuccess("");
                        setIsResetOpen(true);
                      }}>
                        Reset Password
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-on-surface-variant">
                    No users found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit Auth Settings">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Username (Optional)</label>
            <Input 
              placeholder="e.g. jdoe" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Authentication Mode</label>
            <select
              className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              value={authMode}
              onChange={(e) => setAuthMode(e.target.value)}
            >
              <option value="LOCAL">Local Only (Username/Email & Password)</option>
              <option value="SSO">SSO Only (Azure AD)</option>
              <option value="LOCAL_AND_SSO">Both Local and SSO allowed</option>
            </select>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <input 
              type="checkbox" 
              checked={isLoginEnabled} 
              onChange={(e) => setIsLoginEnabled(e.target.checked)} 
              className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20"
            />
            <label className="text-sm font-bold text-on-surface">Allow Login Access</label>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsEditOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveAuthSettings}>Save Settings</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isResetOpen} onClose={() => setIsResetOpen(false)} title="Reset User Password">
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            Set a temporary password for <strong>{selectedUser?.name}</strong>. They will be forced to change it upon next login.
          </p>
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">New Password</label>
            <Input 
              type="text"
              placeholder="Enter at least 8 characters..." 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)} 
            />
          </div>
          {resetError && <p className="text-sm text-error font-bold">{resetError}</p>}
          {resetSuccess && <p className="text-sm text-success font-bold">{resetSuccess}</p>}
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="secondary" onClick={() => setIsResetOpen(false)}>Close</Button>
            <Button variant="primary" onClick={handlePasswordReset}>Reset Password</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
