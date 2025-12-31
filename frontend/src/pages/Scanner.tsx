import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';

const Scanner = () => {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [credentials, setCredentials] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      const response = await axios.get('/api/scanner/credentials');
      setCredentials(response.data);
    } catch (error) {
      console.error('Error fetching credentials:', error);
    }
  };

  const downloadAgent = async () => {
    setGenerating(true);
    try {
      const response = await axios.post(
        '/api/agent/download-installer',
        { os: 'windows' }, // FIX: Always specify Windows OS for Scanner page
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'SecureHabitAgent.bat');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showSuccess('Agent Downloaded', 'Security agent downloaded successfully!');

      // Refresh credentials
      await fetchCredentials();
    } catch (error) {
      console.error('Error downloading agent:', error);
      showError('Download Failed', 'Error downloading agent. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess('Copied!', 'Copied to clipboard successfully.');
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <div className="flex items-center">
            <svg className="w-6 h-6 text-blue-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-lg font-medium text-blue-900">New Agent Available!</h3>
              <p className="text-blue-700 mt-1">
                We've upgraded to a new executable agent that's easier to use. 
                <button 
                  onClick={() => navigate('/agents')} 
                  className="text-blue-600 underline hover:text-blue-800 ml-1"
                >
                  Visit Agent Control Panel
                </button>
              </p>
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-6">Download Security Agent</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Simple Installation Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Click "Download Security Agent" button below</li>
            <li><strong>Double-click</strong> the downloaded <code>SecureHabitAgent.bat</code> file</li>
            <li>Click "Yes" when Windows asks for administrator permission</li>
            <li>The agent will run automatically and show progress</li>
            <li>Wait for completion (2-5 minutes)</li>
            <li>Check your dashboard for security results</li>
          </ol>
          
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-green-800">
                <strong>New:</strong> No PowerShell knowledge required! Just double-click and run.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Download Security Agent</h2>
            <button
              onClick={downloadAgent}
              disabled={generating}
              className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {generating ? 'Generating...' : 'Download Security Agent'}
            </button>
          </div>
          <p className="text-sm text-gray-600">
            This will download a Windows executable (.bat) with your credentials embedded for secure communication.
          </p>
        </div>

        {credentials && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Your API Credentials</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={credentials.apiKey}
                    readOnly
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-mono text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(credentials.apiKey)}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Endpoint
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={credentials.apiEndpoint}
                    readOnly
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-mono text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(credentials.apiEndpoint)}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={credentials.userEmail}
                    readOnly
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 bg-gray-50 text-sm"
                  />
                  <button
                    onClick={() => copyToClipboard(credentials.userEmail)}
                    className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 text-sm"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Keep your API key secure. Do not share it with others or commit it to version control.
              </p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Scanner;

