import React, { useState } from 'react';

const HIERARCHY_LEVELS = [
  {
    level: 1,
    name: 'Agency (Tenant Root)',
    icon: '🏢',
    desc: 'Acme Digital Agency - Root isolation barrier & tenant boundary',
    count: '1 Tenant',
    color: '#6366f1',
  },
  {
    level: 2,
    name: 'Agency Users & Staff',
    icon: '👥',
    desc: 'Owners, Account Managers & SEO Specialists with RBAC permissions',
    count: '8 Team Members',
    color: '#8b5cf6',
  },
  {
    level: 3,
    name: 'Clients (Brands)',
    icon: '💼',
    desc: 'Agency customers (e.g. Apex Dental Care, Summit Realty)',
    count: '12 Brands',
    color: '#3b82f6',
  },
  {
    level: 4,
    name: 'Physical Locations',
    icon: '📍',
    desc: 'Storefronts, clinics, and geographic service territories',
    count: '48 Branches',
    color: '#06b6d4',
  },
  {
    level: 5,
    name: 'Google Business Profiles',
    icon: '🌐',
    desc: 'Verified Google Business listings, reviews, posts & insights',
    count: '46 Connected',
    color: '#10b981',
  },
];

export function HierarchyPreview() {
  const [activeLevel, setActiveLevel] = useState(1);

  return (
    <div className="panel-card">
      <div className="panel-title">
        <span>🌳</span>
        <span>Multi-Tenant Domain Hierarchy</span>
      </div>
      <p className="panel-desc">
        Strict 5-tier relational model guaranteeing zero cross-agency data leaks.
      </p>

      <div className="hierarchy-tree">
        {HIERARCHY_LEVELS.map((item) => (
          <div
            key={item.level}
            className="tree-node"
            style={{
              borderColor: activeLevel === item.level ? item.color : undefined,
              boxShadow: activeLevel === item.level ? `0 0 16px ${item.color}20` : undefined,
              cursor: 'pointer',
            }}
            onClick={() => setActiveLevel(item.level)}
          >
            <div
              className="tree-node-icon"
              style={{
                backgroundColor: `${item.color}20`,
                color: item.color,
                border: `1px solid ${item.color}40`,
              }}
            >
              {item.icon}
            </div>
            <div className="tree-node-info">
              <div className="tree-node-title">
                Level {item.level}: {item.name}
              </div>
              <div className="tree-node-desc">{item.desc}</div>
            </div>
            <span
              className="tree-node-badge"
              style={{
                backgroundColor: `${item.color}15`,
                color: item.color,
                border: `1px solid ${item.color}30`,
              }}
            >
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
