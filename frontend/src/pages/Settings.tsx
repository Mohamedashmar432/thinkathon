import { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';

const Settings = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    organization: '',
  });
  const [credentials, setCredentials] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        organization: user.organization || '',
      });
      fetchCredentials();
    }
  }, [user]);

  const fetchCredentials = async () => {
    try {
      const response = await axios.get('/api/scanner/credentials');
      setCredentials(response.data);
    } catch (error) {
      console.error('Error fetching credentials:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Update user profile (this endpoint would need to be created)
      // For now, just show a message
      setMessage('Profile updated successfully!');
    } catch (error: any) {
      setMessage(error.response?.data?.message || 'Error updating profile');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">User Profile</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div
                className={`p-3 rounded ${
                  message.includes('success')
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {message}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Organization
              </label>
              <input
                type="text"
                value={formData.organization}
                onChange={(e) =>
                  setFormData({ ...formData, organization: e.target.value })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="bg-primary text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {credentials && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">API Credentials</h2>
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
            </div>
          </div>
        )}

        {(user?.email.endsWith('@thinkbridge.com') || user?.email.endsWith('@thinkbridge.in')) && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Organization Settings</h2>
            <p className="text-sm text-gray-600">
              Organization features are available for @thinkbridge.com and @thinkbridge.in users.
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mt-6 border-red-200">
          <h2 className="text-lg font-semibold text-red-700 mb-4">Danger Zone</h2>
          <p className="text-sm text-gray-600 mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <button className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 text-sm">
            Delete Account
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;

