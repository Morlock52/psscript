import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { scriptService, analyticsService } from '../services/api';

const Dashboard: React.FC = () => {
  const { data: recentScripts, isLoading: isLoadingScripts } = useQuery(
    'recentScripts',
    () => scriptService.getScripts({ limit: 5, sort: 'createdAt:desc' })
  );
  
  const { data: usageStats, isLoading: isLoadingStats } = useQuery(
    'usageStats',
    () => analyticsService.getUsageStats()
  );
  
  return (
    <div className="container mx-auto pb-8">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-700 rounded-lg p-4 shadow">
          <h2 className="text-lg font-medium text-gray-300 mb-2">Total Scripts</h2>
          <p className="text-3xl font-bold">
            {isLoadingStats ? (
              <span className="animate-pulse">...</span>
            ) : (
              usageStats?.totalScripts || 0
            )}
          </p>
        </div>
        
        <div className="bg-gray-700 rounded-lg p-4 shadow">
          <h2 className="text-lg font-medium text-gray-300 mb-2">Executions Today</h2>
          <p className="text-3xl font-bold">
            {isLoadingStats ? (
              <span className="animate-pulse">...</span>
            ) : (
              usageStats?.executionsToday || 0
            )}
          </p>
        </div>
        
        <div className="bg-gray-700 rounded-lg p-4 shadow">
          <h2 className="text-lg font-medium text-gray-300 mb-2">Your Scripts</h2>
          <p className="text-3xl font-bold">
            {isLoadingStats ? (
              <span className="animate-pulse">...</span>
            ) : (
              usageStats?.userScripts || 0
            )}
          </p>
        </div>
        
        <div className="bg-gray-700 rounded-lg p-4 shadow">
          <h2 className="text-lg font-medium text-gray-300 mb-2">Average Quality</h2>
          <p className="text-3xl font-bold">
            {isLoadingStats ? (
              <span className="animate-pulse">...</span>
            ) : (
              usageStats?.averageQuality?.toFixed(1) || 'N/A'
            )}
            <span className="text-sm text-gray-400 ml-1">/10</span>
          </p>
        </div>
      </div>
      
      {/* Recent Activity */}
      <div className="bg-gray-700 rounded-lg p-6 shadow mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Recent Scripts</h2>
          <Link
            to="/scripts"
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            View All
          </Link>
        </div>
        
        {isLoadingScripts ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
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
                  <th className="px-4 py-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-600">
                {recentScripts?.scripts?.map((script: any) => (
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
                            script.analysis?.quality_score >= 7
                              ? 'bg-green-500'
                              : script.analysis?.quality_score >= 4
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                        ></span>
                        <span className="text-gray-300">
                          {script.analysis?.quality_score?.toFixed(1) || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {new Date(script.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                
                {(!recentScripts?.scripts || recentScripts.scripts.length === 0) && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                      No scripts found. Upload your first script to get started!
                    </td>
                  </tr>
                )}
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
                  className="w-6 h-6"
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