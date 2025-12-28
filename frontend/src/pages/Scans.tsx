import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import { Scan } from '../../../shared/types';

const Scans = () => {
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDevice, setFilterDevice] = useState('');

  useEffect(() => {
    fetchScans();
  }, [filterDevice]);

  const fetchScans = async () => {
    try {
      const params = filterDevice ? { deviceId: filterDevice } : {};
      const response = await axios.get('/api/scans', { params });
      setScans(response.data.scans);
    } catch (error) {
      console.error('Error fetching scans:', error);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score < 50) return 'text-red-600';
    if (score < 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const uniqueDevices = Array.from(new Set(scans.map(s => s.deviceId)));

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">All Scans</h1>
          <div className="flex items-center space-x-4">
            <select
              value={filterDevice}
              onChange={(e) => setFilterDevice(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">All Devices</option>
              {uniqueDevices.map((device) => (
                <option key={device} value={device}>
                  {device}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scan Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Secure Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Vulnerabilities
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {scans.map((scan) => (
                <tr key={scan._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {scan.systemInfo?.computerName || scan.deviceId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(scan.scanTimestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-semibold ${getScoreColor(scan.secureScore || 0)}`}>
                      {scan.secureScore || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {scan.vulnerabilities?.total || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        scan.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : scan.status === 'analyzing'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {scan.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <Link
                      to={`/scans/${scan._id}`}
                      className="text-primary hover:text-blue-700"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {scans.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No scans found</p>
              <Link
                to="/scanner"
                className="text-primary hover:text-blue-700 mt-2 inline-block"
              >
                Download scanner to get started
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Scans;

