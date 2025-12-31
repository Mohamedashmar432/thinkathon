import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';

interface ChecklistItem {
  id: number;
  task: string;
  description: string;
  completed: boolean;
  completedAt?: string;
  points: number;
  category: 'system' | 'software' | 'network' | 'behavior';
}

interface ChecklistStats {
  totalItems: number;
  completedItems: number;
  completionPercentage: number;
  totalPoints: number;
  earnedPoints: number;
  streak: number;
  contributionScore: number;
  improvementTrend: number;
}

const SecurityChecklist = () => {
  const { theme } = useTheme();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [stats, setStats] = useState<ChecklistStats | null>(null);
  const [loading, setLoading] = useState(true);

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';

  useEffect(() => {
    fetchChecklistData();
  }, []);

  const fetchChecklistData = async () => {
    try {
      const response = await axios.get('/api/dashboard/daily-checklist');
      
      // Use the actual checklist data from the backend
      const checklistData = response.data.checklist || [];
      const transformedChecklist: ChecklistItem[] = checklistData.map((item: any, _index: number) => {
        const pointsMap: Record<string, number> = {
          'OS Updated': 20,
          'No High-Risk Software': 25,
          'Antivirus Enabled': 15,
          'No Critical CVEs': 30,
          'Firewall Active': 10,
        };
        
        const descriptionMap: Record<string, string> = {
          'OS Updated': 'Ensure your operating system is running the latest version with all security patches',
          'No High-Risk Software': 'Remove or update software with critical vulnerabilities',
          'Antivirus Enabled': 'Verify that real-time antivirus protection is active and up-to-date',
          'No Critical CVEs': 'Address all critical Common Vulnerabilities and Exposures',
          'Firewall Active': 'Ensure Windows Firewall or third-party firewall is properly configured',
        };
        
        const categoryMap: Record<string, 'system' | 'software' | 'network' | 'behavior'> = {
          'OS Updated': 'system',
          'No High-Risk Software': 'software',
          'Antivirus Enabled': 'system',
          'No Critical CVEs': 'software',
          'Firewall Active': 'network',
        };

        return {
          id: item.id,
          task: item.task,
          description: descriptionMap[item.task] || 'Security task',
          completed: item.completed,
          completedAt: item.completedAt,
          points: pointsMap[item.task] || 10,
          category: categoryMap[item.task] || 'system'
        };
      });

      setChecklist(transformedChecklist);

      // Calculate stats
      const completedItems = transformedChecklist.filter(item => item.completed).length;
      const totalPoints = transformedChecklist.reduce((sum, item) => sum + item.points, 0);
      const earnedPoints = transformedChecklist.filter(item => item.completed).reduce((sum, item) => sum + item.points, 0);
      
      setStats({
        totalItems: transformedChecklist.length,
        completedItems,
        completionPercentage: response.data.completionPercentage || Math.round((completedItems / transformedChecklist.length) * 100),
        totalPoints,
        earnedPoints,
        streak: response.data.streakDays || 0,
        contributionScore: response.data.contributionToScore || earnedPoints,
        improvementTrend: 0
      });

    } catch (error) {
      console.error('Error fetching checklist:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleChecklistItem = async (itemId: number) => {
    try {
      const item = checklist.find(i => i.id === itemId);
      if (!item) return;

      await axios.put(`/api/dashboard/daily-checklist/${itemId}`, {
        completed: !item.completed
      });

      // Update local state
      setChecklist(prev => prev.map(i => 
        i.id === itemId 
          ? { ...i, completed: !i.completed, completedAt: !i.completed ? new Date().toISOString() : undefined }
          : i
      ));

      // Refresh stats
      fetchChecklistData();
    } catch (error) {
      console.error('Error updating checklist item:', error);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'system':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'software':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-4 4m0 0l-4-4m4 4V3" />
          </svg>
        );
      case 'network':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        );
      case 'behavior':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'system': return 'text-blue-600 bg-blue-100';
      case 'software': return 'text-green-600 bg-green-100';
      case 'network': return 'text-purple-600 bg-purple-100';
      case 'behavior': return 'text-orange-600 bg-orange-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${isDark ? 'border-blue-500' : 'border-blue-600'}`}></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${textPrimary}`}>Security Checklist</h1>
          <p className={`${textSecondary} mt-1`}>
            Complete daily security tasks to improve your security posture and earn points
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className={`${cardBg} rounded-lg p-6`}>
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium ${textSecondary}`}>Completion</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{stats.completionPercentage}%</p>
                </div>
              </div>
            </div>

            <div className={`${cardBg} rounded-lg p-6`}>
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium ${textSecondary}`}>Points Earned</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{stats.earnedPoints}/{stats.totalPoints}</p>
                </div>
              </div>
            </div>

            <div className={`${cardBg} rounded-lg p-6`}>
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium ${textSecondary}`}>Current Streak</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{stats.streak} days</p>
                </div>
              </div>
            </div>

            <div className={`${cardBg} rounded-lg p-6`}>
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className={`text-sm font-medium ${textSecondary}`}>Contribution Score</p>
                  <p className={`text-2xl font-bold ${textPrimary}`}>{stats.contributionScore}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {stats && (
          <div className={`${cardBg} rounded-lg p-6 mb-8`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg font-semibold ${textPrimary}`}>Daily Progress</h2>
              <span className={`text-sm ${textSecondary}`}>
                {stats.completedItems} of {stats.totalItems} completed
              </span>
            </div>
            <div className={`w-full bg-gray-200 rounded-full h-3 ${isDark ? 'bg-gray-700' : ''}`}>
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
                style={{ width: `${stats.completionPercentage}%` }}
              ></div>
            </div>
            <div className="flex justify-between mt-2">
              <span className={`text-xs ${textMuted}`}>0%</span>
              <span className={`text-xs font-medium ${textPrimary}`}>{stats.completionPercentage}%</span>
              <span className={`text-xs ${textMuted}`}>100%</span>
            </div>
          </div>
        )}

        {/* Checklist Items */}
        <div className={`${cardBg} rounded-lg p-6`}>
          <h2 className={`text-lg font-semibold ${textPrimary} mb-6`}>Security Tasks</h2>
          
          <div className="space-y-4">
            {checklist.map((item) => (
              <div 
                key={item.id} 
                className={`border rounded-lg p-4 transition-all duration-200 ${
                  item.completed 
                    ? `border-green-200 bg-green-50 ${isDark ? 'border-green-800 bg-green-900/20' : ''}` 
                    : `border-gray-200 ${isDark ? 'border-gray-700' : ''}`
                }`}
              >
                <div className="flex items-start space-x-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleChecklistItem(item.id)}
                    className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                      item.completed
                        ? 'bg-green-500 border-green-500 text-white'
                        : `border-gray-300 hover:border-green-400 ${isDark ? 'border-gray-600 hover:border-green-500' : ''}`
                    }`}
                  >
                    {item.completed && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <h3 className={`font-medium ${item.completed ? 'line-through text-green-600' : textPrimary}`}>
                          {item.task}
                        </h3>
                        
                        {/* Category Badge */}
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(item.category)}`}>
                          {getCategoryIcon(item.category)}
                          <span className="ml-1 capitalize">{item.category}</span>
                        </span>
                        
                        {/* Points Badge */}
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                        }`}>
                          +{item.points} pts
                        </span>
                      </div>
                      
                      {/* Completion Time */}
                      {item.completed && item.completedAt && (
                        <span className={`text-xs ${textMuted}`}>
                          Completed {new Date(item.completedAt).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    
                    <p className={`text-sm ${item.completed ? 'text-green-600' : textSecondary}`}>
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Achievement Badges */}
        {stats && stats.completionPercentage === 100 && (
          <div className={`${cardBg} rounded-lg p-6 mt-8 text-center`}>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <h3 className={`text-xl font-bold ${textPrimary} mb-2`}>🎉 Perfect Day!</h3>
            <p className={`${textSecondary}`}>
              You've completed all security tasks for today. Your contribution to organizational security is outstanding!
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SecurityChecklist;