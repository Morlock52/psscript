import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/api';
import CategoryPieChart from '../components/charts/CategoryPieChart';

// Reusable style constants for theme-aware styling
const cardStyles = "rounded-lg shadow-[var(--shadow-md)] p-6 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]";
const statCardStyles = "rounded-lg p-4 shadow-[var(--shadow-sm)] bg-[var(--color-bg-tertiary)]";
const progressBarBgStyles = "w-full rounded-full h-2.5 bg-[var(--color-bg-primary)]";
const categoryItemStyles = "flex items-center justify-between p-3 rounded bg-[var(--color-bg-tertiary)]";

const Analytics: React.FC = () => {
  // Fetch real usage statistics
  const { data: usageStats, isLoading: usageLoading } = useQuery({
    queryKey: ['analytics', 'usage'],
    queryFn: analyticsService.getUsageStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch real security metrics
  const { data: securityMetrics, isLoading: securityLoading } = useQuery({
    queryKey: ['analytics', 'security'],
    queryFn: analyticsService.getSecurityMetrics,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch real category distribution
  const { data: categoryData, isLoading: categoryLoading } = useQuery({
    queryKey: ['analytics', 'categories'],
    queryFn: analyticsService.getCategoryDistribution,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Calculate security distribution percentages
  const totalSecurityScripts = (securityMetrics?.highSecurityCount || 0) +
    (securityMetrics?.mediumSecurityCount || 0) +
    (securityMetrics?.lowSecurityCount || 0);

  const highSecurityPercentage = totalSecurityScripts > 0
    ? Math.round((securityMetrics?.highSecurityCount || 0) / totalSecurityScripts * 100)
    : 0;
  const mediumSecurityPercentage = totalSecurityScripts > 0
    ? Math.round((securityMetrics?.mediumSecurityCount || 0) / totalSecurityScripts * 100)
    : 0;
  const lowSecurityPercentage = totalSecurityScripts > 0
    ? Math.round((securityMetrics?.lowSecurityCount || 0) / totalSecurityScripts * 100)
    : 0;

  return (
    <div className="container mx-auto pb-8 text-[var(--color-text-primary)]">
      <h1 className="text-2xl font-bold mb-6">Analytics Dashboard</h1>

      {/* Usage Statistics */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Usage Statistics</h2>
        {usageLoading ? (
          <div className="text-[var(--color-text-tertiary)]">Loading statistics...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={statCardStyles}>
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">Total Scripts</h3>
              <p className="text-2xl font-bold">{usageStats?.totalScripts || 0}</p>
            </div>

            <div className={statCardStyles}>
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">Total Users</h3>
              <p className="text-2xl font-bold">{usageStats?.totalUsers || 0}</p>
            </div>

            <div className={statCardStyles}>
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">Total Analyses</h3>
              <p className="text-2xl font-bold">{usageStats?.totalAnalyses || 0}</p>
            </div>

            <div className={statCardStyles}>
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">Scripts (Last 30 Days)</h3>
              <p className="text-2xl font-bold">
                {usageStats?.totalScripts || 0}
                {usageStats?.scriptsChange && usageStats.scriptsChange !== 0 && (
                  <span className={`text-sm ml-2 ${usageStats.scriptsChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {usageStats.scriptsChange > 0 ? '+' : ''}{usageStats.scriptsChange}%
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Security Overview */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Security Overview</h2>
        {securityLoading ? (
          <div className="text-[var(--color-text-tertiary)]">Loading security metrics...</div>
        ) : (
          <div className={cardStyles}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Script Security Distribution */}
              <div>
                <h3 className="text-lg font-medium mb-4">Script Security Distribution</h3>
                {totalSecurityScripts > 0 ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-green-500">High Security (8-10)</span>
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                          {securityMetrics?.highSecurityCount || 0} scripts ({highSecurityPercentage}%)
                        </span>
                      </div>
                      <div className={progressBarBgStyles}>
                        <div
                          className="bg-green-500 h-2.5 rounded-full"
                          style={{ width: `${highSecurityPercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-yellow-500">Medium Security (5-7)</span>
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                          {securityMetrics?.mediumSecurityCount || 0} scripts ({mediumSecurityPercentage}%)
                        </span>
                      </div>
                      <div className={progressBarBgStyles}>
                        <div
                          className="bg-yellow-500 h-2.5 rounded-full"
                          style={{ width: `${mediumSecurityPercentage}%` }}
                        ></div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm font-medium text-red-500">Low Security (1-4)</span>
                        <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                          {securityMetrics?.lowSecurityCount || 0} scripts ({lowSecurityPercentage}%)
                        </span>
                      </div>
                      <div className={progressBarBgStyles}>
                        <div
                          className="bg-red-500 h-2.5 rounded-full"
                          style={{ width: `${lowSecurityPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[var(--color-text-tertiary)] text-sm">No security data available. Analyze some scripts to see security metrics.</p>
                )}
              </div>

              {/* Common Security Issues */}
              <div>
                <h3 className="text-lg font-medium mb-4">Common Security Issues</h3>
                {securityMetrics?.commonIssues && securityMetrics.commonIssues.length > 0 ? (
                  <ul className="space-y-3">
                    {securityMetrics.commonIssues.map((issue: any, index: number) => (
                      <li key={index} className="flex items-start">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg className="h-4 w-4 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-[var(--color-text-primary)]">{issue.name || issue.title}</h4>
                          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Found in {issue.count} scripts</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[var(--color-text-tertiary)] text-sm">No common security issues detected.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category Distribution with Pie Chart */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Script Category Distribution</h2>
        {categoryLoading ? (
          <div className="text-[var(--color-text-tertiary)]">Loading category distribution...</div>
        ) : categoryData?.categories && categoryData.categories.length > 0 ? (
          <div className={cardStyles}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Pie Chart */}
              <div>
                <h3 className="text-lg font-medium mb-4 text-center">Category Overview</h3>
                <div className="h-80">
                  <CategoryPieChart data={categoryData.categories} />
                </div>
              </div>

              {/* Category Details List */}
              <div>
                <h3 className="text-lg font-medium mb-4">Category Breakdown</h3>
                <div className="space-y-3">
                  {categoryData.categories.map((category: any) => (
                    <div key={category.id} className={categoryItemStyles}>
                      <div className="flex items-center flex-1">
                        <div
                          className="w-4 h-4 rounded-full mr-3"
                          style={{ backgroundColor: category.color }}
                        ></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{category.name}</p>
                          {category.description && (
                            <p className="text-xs text-[var(--color-text-tertiary)] truncate">{category.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-sm font-bold">{category.count}</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">{category.percentage}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={cardStyles}>
            <p className="text-[var(--color-text-tertiary)] text-center">
              No category data available. Upload and categorize some scripts to see distribution.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
