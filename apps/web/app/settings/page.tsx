"use client";

import React, { useState } from "react";
import { Card, Button } from "@ahh-wfm/ui/src";

export default function SettingsPage() {
  const [geoFenceAlert, setGeoFenceAlert] = useState(true);
  const [offlineSync, setOfflineSync] = useState(true);
  const [latencyThreshold, setLatencyThreshold] = useState("200");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">System Settings</h1>
        <p className="text-sm text-on-surface-variant">Global configurations for geo-fencing, sync thresholds, and alerts</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Geo-fencing and GPS settings */}
        <Card className="space-y-4">
          <h2 className="text-sm font-bold text-primary border-b border-border-subtle pb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">location_on</span>
            <span>Geo-Fence Configurations</span>
          </h2>
          <div className="space-y-4 text-xs font-semibold text-primary">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-primary">Strict Geo-Fence Boundary</p>
                <p className="text-[10px] text-on-surface-variant font-medium">Flag check-ins outside site radius immediately</p>
              </div>
              <input
                type="checkbox"
                checked={geoFenceAlert}
                onChange={() => setGeoFenceAlert(!geoFenceAlert)}
                className="w-4 h-4 rounded text-secondary focus:ring-secondary border-outline-variant"
              />
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-primary">Allow Offline Marking & Buffer</p>
                <p className="text-[10px] text-on-surface-variant font-medium">Cache check-ins when employee lacks data connection</p>
              </div>
              <input
                type="checkbox"
                checked={offlineSync}
                onChange={() => setOfflineSync(!offlineSync)}
                className="w-4 h-4 rounded text-secondary focus:ring-secondary border-outline-variant"
              />
            </div>
          </div>
        </Card>

        {/* Sync settings */}
        <Card className="space-y-4">
          <h2 className="text-sm font-bold text-primary border-b border-border-subtle pb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">sync</span>
            <span>Integration Sync Parameters</span>
          </h2>
          <div className="space-y-4 text-xs">
            <div className="flex flex-col gap-1.5">
              <label className="font-bold text-primary">Latency Alert Threshold (ms)</label>
              <input
                type="number"
                value={latencyThreshold}
                onChange={(e) => setLatencyThreshold(e.target.value)}
                className="bg-surface border border-outline-variant rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/20 text-xs w-28 font-mono font-bold"
              />
              <p className="text-[10px] text-on-surface-variant">Triggers IT health alerts if sync latency exceeds value</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" className="font-bold">Reset Defaults</Button>
        <Button className="font-bold" onClick={() => alert("Settings saved successfully!")}>Save Settings</Button>
      </div>
    </div>
  );
}
