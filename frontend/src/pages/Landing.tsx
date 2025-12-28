import { Link } from 'react-router-dom';

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <nav className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold text-white">Secure Habit</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/login"
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Register
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl font-bold mb-6">
            Security Vulnerability Scanner
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Protect your systems with comprehensive vulnerability scanning and real-time security insights.
          </p>
          <div className="flex justify-center space-x-4">
            <Link
              to="/signup"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
            >
              Register
            </Link>
            <Link
              to="/login"
              className="bg-gray-800 text-white px-8 py-3 rounded-lg text-lg font-semibold border border-gray-700 hover:bg-gray-700 transition"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-lg border border-gray-700">
            <div className="text-3xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold mb-2">Comprehensive Scanning</h3>
            <p className="text-gray-300">
              Scan your systems for vulnerabilities, outdated software, and security patches.
            </p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-lg border border-gray-700">
            <div className="text-3xl mb-4">📊</div>
            <h3 className="text-xl font-semibold mb-2">Real-time Dashboard</h3>
            <p className="text-gray-300">
              Get instant insights into your security posture with detailed analytics.
            </p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm p-6 rounded-lg border border-gray-700">
            <div className="text-3xl mb-4">🛡️</div>
            <h3 className="text-xl font-semibold mb-2">Actionable Recommendations</h3>
            <p className="text-gray-300">
              Receive prioritized remediation steps to improve your security score.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
