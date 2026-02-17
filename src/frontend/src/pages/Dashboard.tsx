import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { scriptService, categoryService, analysisService } from '../services/api-enhanced';
import { scriptService as scriptApi } from '../services/api';

// Components
import ScriptCard from '../components/ScriptCard';
import CategoryPieChart from '../components/charts/CategoryPieChart';
import SecurityScoreChart from '../components/charts/SecurityScoreChart';
import ScriptTrendChart from '../components/charts/ScriptTrendChart';
import ActivityFeed from '../components/ActivityFeed';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';

const Dashboard: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [trendPeriod, setTrendPeriod] = useState<'week' | 'month' | 'year'>('week');
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  // Delete script mutation
  const deleteScriptMutation = useMutation({
    mutationFn: (id: string) => scriptApi.deleteScript(id),
    onSuccess: () => {
      // Invalidate scripts query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (error: any) => {
      alert(error.message || 'Failed to delete script');
    }
  });

  // Handle delete with confirmation
  const handleDeleteScript = (id: string) => {
    if (window.confirm('Are you sure you want to delete this script?')) {
      deleteScriptMutation.mutate(id);
    }
  };

  // Fetch scripts
  const {
    data: scripts,
    isLoading: isLoadingScripts,
    error: scriptsError
  } = useQuery({
    queryKey: ['scripts', selectedCategory],
    queryFn: () => selectedCategory
      ? scriptService.getScriptsByCategory(selectedCategory)
      : scriptService.getRecentScripts(8),
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  // Fetch categories
  const {
    data: categories,
    isLoading: isLoadingCategories
  } = useQuery({
    queryKey: ['categories'],
    queryFn: () => categoryService.getCategories(),
    staleTime: 300000,
  });

  // Fetch statistics
  const {
    data: stats,
    isLoading: isLoadingStats
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => scriptService.getDashboardStats(),
    staleTime: 300000,
  });

  // Fetch recent activity
  const {
    data: activity,
    isLoading: isLoadingActivity
  } = useQuery({
    queryKey: ['recent-activity'],
    queryFn: () => scriptService.getRecentActivity(),
    enabled: isAuthenticated,
    staleTime: 60000,
  });

  // Fetch security metrics
  const {
    data: securityMetrics,
    isLoading: isLoadingSecurityMetrics
  } = useQuery({
    queryKey: ['security-metrics'],
    queryFn: () => analysisService.getSecurityMetrics(),
    staleTime: 300000,
  });

  // Fetch trend data
  const {
    data: trendData,
    isLoading: isLoadingTrendData,
  } = useQuery({
    queryKey: ['script-trends', trendPeriod],
    queryFn: () => scriptService.getScriptTrends(trendPeriod),
    staleTime: 300000,
  });

  // Card base styles using CSS variables
  const cardStyles = "p-6 rounded-xl shadow-[var(--shadow-md)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] transition-colors duration-300 glow-card";

  // Button styles
  const primaryBtnStyles = "px-3 py-1.5 text-sm rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white transition-colors";
  const secondaryBtnStyles = "px-3 py-1.5 text-sm rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 text-[var(--color-text-secondary)] transition-colors";

  // Chip/pill styles
  const chipActiveStyles = "px-3 py-1 text-sm rounded-full bg-[var(--color-primary)] text-white";
  const chipInactiveStyles = "px-3 py-1 text-sm rounded-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/80 transition-colors";

  const panelVariants = {
    hidden: { opacity: 0, y: 12 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.3,
      },
    },
  };

  const pageVariants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.28,
        staggerChildren: prefersReducedMotion ? 0 : 0.06,
      },
    },
  };

  return (
    <motion.div
      className="text-[var(--color-text-primary)]"
      initial={prefersReducedMotion ? false : 'hidden'}
      animate="show"
      variants={pageVariants}
    >
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] bg-clip-text text-transparent">
          {isAuthenticated
            ? `Welcome back, ${user?.username || 'User'}!`
            : 'Welcome to PSScript'}
        </h1>
        <p className="text-lg text-[var(--color-text-secondary)]">
          AI-powered PowerShell script management and analysis platform
        </p>
      </div>

      {/* Stats Cards */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        variants={pageVariants}
      >
        <motion.div variants={panelVariants}>
          <StatCard
            title="Total Scripts"
            value={stats?.totalScripts || 0}
            icon="script"
            change={stats?.scriptsChange || 0}
            isLoading={isLoadingStats}
          />
        </motion.div>
        <motion.div variants={panelVariants}>
          <StatCard
            title="Categories"
            value={stats?.totalCategories || 0}
            icon="category"
            isLoading={isLoadingStats}
          />
        </motion.div>
        <motion.div variants={panelVariants}>
          <StatCard
            title="Avg. Security Score"
            value={stats?.avgSecurityScore?.toFixed(1) || '0.0'}
            icon="security"
            suffix="/10"
            change={stats?.securityScoreChange || 0}
            isLoading={isLoadingStats}
          />
        </motion.div>
        <motion.div variants={panelVariants}>
          <StatCard
            title="AI Analyses"
            value={stats?.totalAnalyses || 0}
            icon="analysis"
            change={stats?.analysesChange || 0}
            isLoading={isLoadingStats}
          />
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Scripts */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div className={cardStyles} variants={panelVariants}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Recent Scripts</h2>
              <Link to="/scripts" className={primaryBtnStyles}>
                View All
              </Link>
            </div>

            {/* Category Filter */}
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setSelectedCategory(null)}
                className={selectedCategory === null ? chipActiveStyles : chipInactiveStyles}
              >
                All
              </button>

              {categories?.categories?.map(category => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={selectedCategory === category.id ? chipActiveStyles : chipInactiveStyles}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {/* Scripts Grid */}
            {isLoadingScripts ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : scriptsError ? (
              <div className="text-center py-8 text-red-500">
                Error loading scripts. Please try again.
              </div>
            ) : scripts?.length === 0 ? (
              <div className="text-center py-8 text-[var(--color-text-tertiary)]">
                {selectedCategory
                  ? "No scripts found in this category."
                  : "No scripts found. Create your first script!"}
                <div className="mt-4">
                  <Link to="/chat" className={primaryBtnStyles}>
                    Create with AI
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scripts?.map(script => (
                  <ScriptCard
                    key={script.id}
                    script={script}
                    onDelete={handleDeleteScript}
                  />
                ))}
              </div>
            )}
          </motion.div>

          {/* Security Metrics */}
          <motion.div className={cardStyles} variants={panelVariants}>
            <h2 className="text-xl font-bold mb-4 text-[var(--color-text-primary)]">Security Metrics</h2>

            {isLoadingSecurityMetrics ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="h-64">
                <SecurityScoreChart data={securityMetrics?.securityScores || []} />
              </div>
            )}
          </motion.div>

          {/* Script Trends */}
          <motion.div className={cardStyles} variants={panelVariants}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Script Activity Trends</h2>
              <div className="flex gap-1">
                {(['week', 'month', 'year'] as const).map(period => (
                  <button
                    key={period}
                    onClick={() => setTrendPeriod(period)}
                    className={`px-2 py-1 text-xs rounded-md transition-colors ${
                      trendPeriod === period
                        ? 'bg-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]/80'
                    }`}
                  >
                    {period.charAt(0).toUpperCase() + period.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {isLoadingTrendData ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="h-64">
                <ScriptTrendChart
                  data={trendData || { uploads: [], executions: [], analyses: [] }}
                  period={trendPeriod}
                />
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Column - Activity & Stats */}
        <div className="space-y-6">
          {/* Category Distribution */}
          <motion.div className={cardStyles} variants={panelVariants}>
            <h2 className="text-xl font-bold mb-4 text-[var(--color-text-primary)]">Script Categories</h2>

            {isLoadingCategories ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="h-64">
                <CategoryPieChart data={categories?.categories || []} />
              </div>
            )}
          </motion.div>

          {/* Recent Activity */}
          <motion.div className={cardStyles} variants={panelVariants}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Recent Activity</h2>
              {isAuthenticated && (
                <Link to="/scripts" className={secondaryBtnStyles}>
                  View All
                </Link>
              )}
            </div>

            {!isAuthenticated ? (
              <div className="text-center py-4 text-[var(--color-text-tertiary)]">
                <p>Sign in to view your activity</p>
                <div className="mt-4">
                  <Link to="/login" className={primaryBtnStyles}>
                    Sign In
                  </Link>
                </div>
              </div>
            ) : isLoadingActivity ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <ActivityFeed activities={activity || []} />
            )}
          </motion.div>
        </div>
      </div>

      {/* Quick Actions */}
      <motion.div className={`mt-8 ${cardStyles}`} variants={panelVariants}>
        <h2 className="text-xl font-bold mb-4 text-[var(--color-text-primary)]">Quick Actions</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Chat with AI */}
          <motion.div
            variants={panelVariants}
            whileHover={prefersReducedMotion ? undefined : { y: -4, scale: 1.01 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
          >
            <Link
              to="/chat"
              className="p-4 rounded-xl flex flex-col items-center text-center transition-all hover:scale-105 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 glow-card"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-blue-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <h3 className="font-medium text-[var(--color-text-primary)]">Chat with AI</h3>
              <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Get help with PowerShell scripts</p>
            </Link>
          </motion.div>

          {/* Manage Scripts */}
          <motion.div
            variants={panelVariants}
            whileHover={prefersReducedMotion ? undefined : { y: -4, scale: 1.01 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
          >
            <Link
              to="/scripts"
              className="p-4 rounded-xl flex flex-col items-center text-center transition-all hover:scale-105 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 glow-card"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-emerald-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-medium text-[var(--color-text-primary)]">Manage Scripts</h3>
              <p className="text-sm text-[var(--color-text-tertiary)] mt-1">Browse and organize your scripts</p>
            </Link>
          </motion.div>

          {/* Documentation */}
          <motion.div
            variants={panelVariants}
            whileHover={prefersReducedMotion ? undefined : { y: -4, scale: 1.01 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
          >
            <Link
              to="/documentation"
              className="p-4 rounded-xl flex flex-col items-center text-center transition-all hover:scale-105 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20 glow-card"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-violet-500/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="font-medium text-[var(--color-text-primary)]">Documentation</h3>
              <p className="text-sm text-[var(--color-text-tertiary)] mt-1">PowerShell reference and guides</p>
            </Link>
          </motion.div>

          {/* Settings */}
          <motion.div
            variants={panelVariants}
            whileHover={prefersReducedMotion ? undefined : { y: -4, scale: 1.01 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
          >
            <Link
              to={isAuthenticated ? "/settings" : "/login"}
              className="p-4 rounded-xl flex flex-col items-center text-center transition-all hover:scale-105 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary)]/80 border border-[var(--color-border-default)] glow-card"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-[var(--color-bg-secondary)]">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-medium text-[var(--color-text-primary)]">{isAuthenticated ? "Settings" : "Sign In"}</h3>
              <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{isAuthenticated ? "Configure your account" : "Access your account"}</p>
            </Link>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
