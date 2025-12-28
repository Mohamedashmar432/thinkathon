import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';

const Scanner = () => {
  const [credentials, setCredentials] = useState<any>(null);
  const [loading, setLoading] = useState(false);
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

  const generateScanner = async () => {
    setGenerating(true);
    try {
      const response = await axios.post(
        '/api/scanner/generate',
        {},
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'scanner.ps1');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      // Refresh credentials
      await fetchCredentials();
    } catch (error) {
      console.error('Error generating scanner:', error);
      alert('Error generating scanner. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Download Scanner</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Step-by-Step Instructions</h2>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Click "Generate Scanner" button below to download your personalized scanner script</li>
            <li>Right-click the downloaded scanner.ps1 file</li>
            <li>Select "Run with PowerShell"</li>
            <li>Allow administrator access when prompted</li>
            <li>Wait for the scan to complete (this may take a few minutes)</li>
            <li>Check your dashboard for results</li>
          </ol>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Generate Scanner</h2>
            <button
              onClick={generateScanner}
              disabled={generating}
              className="bg-primary text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Scanner'}
            </button>
          </div>
          <p className="text-sm text-gray-600">
            This will create a personalized PowerShell script with your API credentials embedded.
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

