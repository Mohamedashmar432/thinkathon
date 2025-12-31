import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';

interface Recommendation {
  _id: string;
  recommendationId: string;
  title: string;
  description: string;
  action: string;
  whyItMatters: string;
  expectedRiskReduction: number;
  priority: 'high' | 'medium' | 'low';
  category: 'endpoint' | 'system' | 'network' | 'application';
  estimatedTimeMinutes: number;
  status: 'not_started' | 'in_progress' | 'completed';
  userActionable: boolean;
  deviceId: string;
  createdAt: string;
  updatedAt: string;
}

const Recommendations = () => {
  const { theme } = useTheme();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [scoreExplanation, setScoreExplanation] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expandedRec, setExpandedRec] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const cardBg = isDark ? 'bg-gray-900 border border-gray-800' : 'bg-white border border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-300' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    try {
      const response = await axios.get('/api/user-recommendations');
      setRecommendations(response.data.recommendations || []);
      
      // Generate a score explanation based on the stats
      if (response.data.stats) {
        const stats = response.data.stats;
        const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        const explanation = `You have ${stats.total} security recommendations. ${stats.completed} are completed (${completionRate}% completion rate). ${stats.notStarted} recommendations are waiting to be started. Completing these recommendations could reduce your security risk by up to ${stats.totalRiskReduction}%.`;
        setScoreExplanation(explanation);
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateRecommendationStatus = async (recommendationId: string, status: string) => {
    try {
      await axios.put(`/api/user-recommendations/${recommendationId}/status`, { status });
      
      setRecommendations(prev => 
        prev.map(rec => 
          rec.recommendationId === recommendationId ? { ...rec, status: status as any } : rec
        )
      );
    } catch (error) {
      console.error('Error updating recommendation status:', error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'endpoint':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        );
      case 'system':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'network':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        );
      case 'application':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'in_progress': return 'text-blue-600 bg-blue-100';
      case 'not_started': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCompletionStats = () => {
    const total = recommendations.length;
    const completed = recommendations.filter(r => r.status === 'completed').length;
    const inProgress = recommendations.filter(r => r.status === 'in_progress').length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { total, completed, inProgress, percentage };
  };

  const stats = getCompletionStats();

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
          <h1 className={`text-3xl font-bold ${textPrimary}`}>Security Recommendations</h1>
          <p className={`${textSecondary} mt-1`}>
            AI-powered recommendations to improve your security posture
          </p>
        </div>

        {/* Score Explanation */}
        {scoreExplanation && (
          <div className={`${cardBg} rounded-lg p-6 mb-8`}>
            <div className="flex items-start">
              <div className="p-2 bg-blue-100 rounded-lg mr-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className={`text-lg font-medium ${textPrimary} mb-2`}>Your Security Score</h3>
                <p className={`${textSecondary}`}>{scoreExplanation}</p>
              </div>
            </div>
          </div>
        )}

        {/* Progress Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className={`${cardBg} rounded-lg p-6`}>
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${textSecondary}`}>Total</p>
                <p className={`text-2xl font-bold ${textPrimary}`}>{stats.total}</p>
              </div>
            </div>
          </div>

          <div className={`${cardBg} rounded-lg p-6`}>
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${textSecondary}`}>Completed</p>
                <p className={`text-2xl font-bold ${textPrimary}`}>{stats.completed}</p>
              </div>
            </div>
          </div>

          <div className={`${cardBg} rounded-lg p-6`}>
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${textSecondary}`}>In Progress</p>
                <p className={`text-2xl font-bold ${textPrimary}`}>{stats.inProgress}</p>
              </div>
            </div>
          </div>

          <div className={`${cardBg} rounded-lg p-6`}>
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className={`text-sm font-medium ${textSecondary}`}>Progress</p>
                <p className={`text-2xl font-bold ${textPrimary}`}>{stats.percentage}%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className={`${cardBg} rounded-lg p-6 mb-8`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold ${textPrimary}`}>Overall Progress</h2>
            <span className={`text-sm ${textSecondary}`}>
              {stats.completed} of {stats.total} completed
            </span>
          </div>
          <div className={`w-full bg-gray-200 rounded-full h-3 ${isDark ? 'bg-gray-700' : ''}`}>
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${stats.percentage}%` }}
            ></div>
          </div>
        </div>

        {/* Recommendations List */}
        {recommendations.length === 0 ? (
          <div className={`${cardBg} rounded-lg p-12 text-center`}>
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <h3 className={`text-lg font-medium ${textPrimary} mb-2`}>No recommendations available</h3>
            <p className={`${textSecondary} mb-6`}>
              Run a security scan to get personalized recommendations
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations
              .sort((a, b) => {
                // Sort by priority (high first), then by risk reduction
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                  return priorityOrder[b.priority] - priorityOrder[a.priority];
                }
                return b.expectedRiskReduction - a.expectedRiskReduction;
              })
              .map((rec) => (
                <div key={rec.recommendationId} className={`${cardBg} rounded-lg p-6`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <div className={`p-2 rounded-lg ${getPriorityColor(rec.priority).replace('text-', 'bg-').replace('-600', '-100')}`}>
                          {getCategoryIcon(rec.category)}
                        </div>
                        <div>
                          <h3 className={`text-lg font-semibold ${textPrimary}`}>{rec.title}</h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(rec.priority)}`}>
                              {rec.priority.toUpperCase()}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(rec.status)}`}>
                              {rec.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className={`text-xs ${textMuted}`}>
                              ~{rec.estimatedTimeMinutes} min
                            </span>
                            <span className={`text-xs ${textMuted}`}>
                              -{rec.expectedRiskReduction}% risk
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <p className={`${textSecondary} mb-4`}>{rec.description}</p>
                      
                      {expandedRec === rec.recommendationId && (
                        <div className={`mt-4 p-4 rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                          <div className="space-y-3">
                            <div>
                              <h4 className={`font-medium ${textPrimary} mb-1`}>How to do it:</h4>
                              <p className={`text-sm ${textSecondary}`}>{rec.action}</p>
                            </div>
                            
                            <div>
                              <h4 className={`font-medium ${textPrimary} mb-1`}>Why it matters:</h4>
                              <p className={`text-sm ${textSecondary}`}>{rec.whyItMatters}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => setExpandedRec(expandedRec === rec.recommendationId ? null : rec.recommendationId)}
                        className={`px-3 py-1 rounded text-sm ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'} transition-colors`}
                      >
                        {expandedRec === rec.recommendationId ? 'Hide Details' : 'Show Details'}
                      </button>
                      
                      {rec.status !== 'completed' && (
                        <select
                          value={rec.status}
                          onChange={(e) => updateRecommendationStatus(rec.recommendationId, e.target.value)}
                          className={`px-3 py-1 rounded text-sm border ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                        >
                          <option value="not_started">Not Started</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      )}
                      
                      {rec.status === 'completed' && (
                        <div className="flex items-center text-green-600 text-sm">
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Done!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Recommendations;