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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-8 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Build Security as a Habit
          </h1>
          <p className="text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Transform your security posture with intelligent endpoint monitoring, AI-driven recommendations, and comprehensive threat intelligence.
          </p>
          <div className="flex justify-center space-x-6">
            <Link
              to="/signup"
              className="bg-blue-600 text-white px-10 py-4 rounded-lg text-xl font-semibold hover:bg-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Get Started
            </Link>
            <Link
              to="/login"
              className="bg-gray-800 text-white px-10 py-4 rounded-lg text-xl font-semibold border border-gray-700 hover:bg-gray-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Sign In
            </Link>
          </div>
          
          <div className="mt-16">
            <p className="text-gray-400 text-lg">
              Enterprise-grade security platform for modern organizations
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
