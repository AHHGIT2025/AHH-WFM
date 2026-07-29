"use client";

import React, { useState } from 'react';
import { Card } from '@ahh-wfm/ui';
import SurveyConfig from './SurveyConfig';
import SiteConditionsConfig from './SiteConditionsConfig';
import CostConfig from './CostConfig';

type Tab = 'survey' | 'site' | 'cost';

export default function PreContractConfigPage() {
  const [activeTab, setActiveTab] = useState<Tab>('survey');

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pre-Contract Configuration</h1>
        <p className="text-muted-foreground mt-1 text-sm text-gray-500">Manage templates, site conditions, and cost configuration for Pre-Contract workflows.</p>
      </div>

      <Card padded={false} className="mb-6">
        <div className="flex border-b border-outline-variant">
          <button
            className={`px-6 py-3 text-sm font-bold transition-colors ${activeTab === 'survey' ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
            onClick={() => setActiveTab('survey')}
          >
            Survey Configuration
          </button>
          <button
            className={`px-6 py-3 text-sm font-bold transition-colors ${activeTab === 'site' ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
            onClick={() => setActiveTab('site')}
          >
            Site Conditions
          </button>
          <button
            className={`px-6 py-3 text-sm font-bold transition-colors ${activeTab === 'cost' ? 'border-b-2 border-primary text-primary bg-primary/5' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
            onClick={() => setActiveTab('cost')}
          >
            Cost Configuration
          </button>
        </div>
      </Card>

      <div className="w-full">
        {activeTab === 'survey' && <SurveyConfig />}
        {activeTab === 'site' && <SiteConditionsConfig />}
        {activeTab === 'cost' && <CostConfig />}
      </div>
    </div>
  );
}
