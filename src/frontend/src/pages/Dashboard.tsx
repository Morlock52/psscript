import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { scriptService, analyticsService } from '../services/api';

// Define types for better type safety
interface Script {
  id: string;
  title: string;
  category?: { 
    name: string;
  };
  user?: {
    username: string;
  };
  analysis?: {
    code_quality_score: number;
  };
  updatedAt: string;
}

interface Stats {
  totalScripts: number;
  executionsToday: number;
  userScripts: number;
  averageQuality: number;
}

const Dashboard: React.FC = () => {
  // Use React Query for data fetching with caching
  const { 
    data: scriptsData,
    isLoading: isScriptsLoading,
    error: scriptsError
  } = useQuery(
    ['recentScripts'], 
    () => scriptService.getScripts({ limit: 5, sort: 'updated' }),
    { staleTime: 30000 }
  );
  
  const {
    data: statsData,
    isLoading: isStatsLoading,
    error: statsError
  } = useQuery(
    ['usageStats'],
    () => analyticsService.getUsageStats(),
    { staleTime: 30000 }
  );
  
  // Use useMemo to derive state from query results
  const recentScripts = useMemo<Script[]>(() => 
    scriptsData?.scripts || [], 
    [scriptsData]
  );
  
  const stats = useMemo<Stats>(() => 
    statsData || {
      totalScripts: 0,
      executionsToday: 0,
      userScripts: 0,
      averageQuality: 0
    }, 
    [statsData]
  );
  
  const isLoading = isScriptsLoading || isStatsLoading;
  const hasError = scriptsError || statsError;
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (hasError) {
    return (
      <div className="bg-red-800 text-white p-4 rounded-lg my-4">
        <h3 className="font-bold mb-2">Error Loading Dashboard</h3>
        <p>There was a problem loading the dashboard data. Please try again later.</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto pb-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-700 rounded-lg p-4 shadow">
          <div className="flex justify-between">
            <h2 className="text-lg font-medium text-gray-300 mb-2">Total Scripts</h2>
            <Link
              to="/manage-files"
              className="text-green-400 hover:text-green-300 text-sm flex items-center"
              title="Manage Scripts"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                ></path>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                ></path>
              </svg>
            </Link>
          </div>
          <p className="text-3xl font-bold">
            {stats?.totalScripts || 0}
          </p>
        </div>
        
        <div className="bg-gray-700 rounded-lg p-4 shadow">
          <h2 className="text-lg font-medium text-gray-300 mb-2">Executions Today</h2>
          <p className="text-3xl font-bold">
            {stats?.executionsToday || 0}
          </p>
        </div>
        
        <div className="bg-gray-700 rounded-lg p-4 shadow">
          <h2 className="text-lg font-medium text-gray-300 mb-2">Your Scripts</h2>
          <p className="text-3xl font-bold">
            {stats?.userScripts || 0}
          </p>
        </div>
        
        <div className="bg-gray-700 rounded-lg p-4 shadow">
          <h2 className="text-lg font-medium text-gray-300 mb-2">Average Quality</h2>
          <p className="text-3xl font-bold">
            {stats?.averageQuality?.toFixed(1) || 'N/A'}
            <span className="text-sm text-gray-400 ml-1">/10</span>
          </p>
        </div>
      </div>
      
      {/* Recent Activity */}
      <div className="bg-gray-700 rounded-lg p-6 shadow mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Recent Scripts</h2>
          <div className="flex space-x-4">
            <Link
              to="/manage-files"
              className="text-green-400 hover:text-green-300 text-sm flex items-center"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                ></path>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                ></path>
              </svg>
              Manage
            </Link>
            <Link
              to="/scripts"
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              View All
            </Link>
          </div>
        </div>
        
        {recentScripts.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            <p>No scripts found. Upload your first script to get started!</p>
            <Link
              to="/scripts/upload"
              className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Upload Script
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-left text-xs uppercase text-gray-400">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Category</th>
                  <th className="px-4 py-2">Author</th>
                  <th className="px-4 py-2">Quality</th>
                  <th className="px-4 py-2">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-600">
                {recentScripts.map((script: any) => (
                  <tr key={script.id} className="hover:bg-gray-600">
                    <td className="px-4 py-3">
                      <Link
                        to={`/scripts/${script.id}`}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        {script.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{script.category?.name || 'Uncategorized'}</td>
                    <td className="px-4 py-3 text-gray-300">{script.user?.username || 'Unknown'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        <span
                          className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            script.analysis?.code_quality_score >= 7
                              ? 'bg-green-500'
                              : script.analysis?.code_quality_score >= 4
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                        ></span>
                        <span className="text-gray-300">
                          {script.analysis?.code_quality_score?.toFixed(1) || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {new Date(script.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* AI Insights */}
      <div className="bg-gray-700 rounded-lg p-6 shadow">
        <h2 className="text-xl font-bold mb-4">AI Insights</h2>
        
        <div className="p-4 bg-gray-800 border border-gray-600 rounded-lg">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  ></path>
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-medium mb-2">Script Quality Recommendations</h3>
              <p className="text-gray-300 mb-4">
                Based on your recent uploads, here are some areas for improvement:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-gray-300">
                <li>Consider adding more comprehensive error handling to your scripts</li>
                <li>Documentation for parameters could be improved in several scripts</li>
                <li>Your networking scripts show good practice with credential management</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;