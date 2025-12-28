import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';
import { Scan } from '../../../shared/types';

const ScanDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchScan();
    }
  }, [id]);

  const fetchScan = async () => {
    try {
      const response = await axios.get(`/api/scans/${id}`);
      setScan(response.data.scan);
    } catch (error) {
      console.error('Error fetching scan:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!scan) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-500">Scan not found</p>
        </div>
      </Layout>
    );
  }

  const vulnerabilitiesBySeverity = {
    critical: scan.vulnerabilities.items.filter((v) => v.severity === 'critical'),
    high: scan.vulnerabilities.items.filter((v) => v.severity === 'high'),
    medium: scan.vulnerabilities.items.filter((v) => v.severity === 'medium'),
    low: scan.vulnerabilities.items.filter((v) => v.severity === 'low'),
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/scans" className="text-primary hover:text-blue-700 mb-4 inline-block">
          ← Back to Scans
        </Link>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Scan Details</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Secure Score</p>
              <p className="text-3xl font-bold">{scan.secureScore || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Endpoint Exposure Score</p>
              <p className="text-3xl font-bold">{scan.endpointExposureScore || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Scan Date</p>
              <p className="text-lg font-semibold">
                {new Date(scan.scanTimestamp).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">System Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Computer Name</p>
              <p className="font-semibold">{scan.systemInfo.computerName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">OS</p>
              <p className="font-semibold">{scan.systemInfo.osName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">OS Version</p>
              <p className="font-semibold">{scan.systemInfo.osVersion}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Architecture</p>
              <p className="font-semibold">{scan.systemInfo.architecture}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Manufacturer</p>
              <p className="font-semibold">{scan.systemInfo.manufacturer}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Model</p>
              <p className="font-semibold">{scan.systemInfo.model}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Vulnerabilities</h2>
          <div className="mb-4 grid grid-cols-5 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{scan.vulnerabilities.total}</p>
              <p className="text-xs text-gray-600">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{scan.vulnerabilities.critical}</p>
              <p className="text-xs text-gray-600">Critical</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">{scan.vulnerabilities.high}</p>
              <p className="text-xs text-gray-600">High</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">{scan.vulnerabilities.medium}</p>
              <p className="text-xs text-gray-600">Medium</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{scan.vulnerabilities.low}</p>
              <p className="text-xs text-gray-600">Low</p>
            </div>
          </div>

          {(['critical', 'high', 'medium', 'low'] as const).map((severity) => (
            vulnerabilitiesBySeverity[severity].length > 0 && (
              <div key={severity} className="mb-6">
                <h3 className="text-md font-semibold mb-2 capitalize">{severity} Vulnerabilities</h3>
                <div className="space-y-3">
                  {vulnerabilitiesBySeverity[severity].map((vuln, idx) => (
                    <div
                      key={idx}
                      className={`border rounded-lg p-4 ${getSeverityColor(severity)}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold">{vuln.software} {vuln.version}</p>
                          <p className="text-sm">{vuln.cveId}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">CVSS: {vuln.cvssScore}</p>
                          {vuln.exploitable && (
                            <span className="text-xs bg-red-200 text-red-900 px-2 py-1 rounded">
                              EXPLOITABLE
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm mb-2">{vuln.description}</p>
                      <p className="text-sm font-semibold">Recommendation:</p>
                      <p className="text-sm">{vuln.recommendation}</p>
                      {vuln.affectedEndpoints && vuln.affectedEndpoints.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-semibold">Affected Endpoints:</p>
                          <ul className="list-disc list-inside text-sm">
                            {vuln.affectedEndpoints.map((ep, epIdx) => (
                              <li key={epIdx} className="font-mono">{ep}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Installed Software</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Version
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Publisher
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Install Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scan.software.map((software, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {software.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {software.version}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {software.publisher}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {software.installDate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {scan.browserExtensions && scan.browserExtensions.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-700 mb-4">Browser Extensions</h2>
            <div className="space-y-2">
              {scan.browserExtensions.map((ext, idx) => (
                <div key={idx} className="border rounded p-3">
                  <p className="font-semibold">{ext.name}</p>
                  <p className="text-sm text-gray-600">
                    {ext.browser} • Version {ext.version}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ScanDetail;

