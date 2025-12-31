import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  name: string;
  path: string;
  icon: string;
  children?: NavItem[];
}

const SideNav = () => {
  const location = useLocation();
  const { user } = useAuth();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['dashboard']));

  // Check if user is admin
  const isAdmin = user?.email?.includes('admin') || 
                  user?.email === 'ashmar@thinkbridge.in' ||
                  ['admin@thinkbridge.in', 'admin@thinkbridge.com', 'support@thinkbridge.in'].includes(user?.email || '');

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const navItems: NavItem[] = [
    { name: 'Home', path: '/dashboard', icon: '🏠' },
    {
      name: 'Security',
      path: '#',
      icon: '🛡️',
      children: [
        { name: 'Dashboard', path: '/dashboard', icon: '📊' },
        { name: 'Threat Intelligence', path: '/threat-intelligence', icon: '🔍' },
        { name: 'Inventory', path: '/inventory', icon: '📦' },
        { name: 'Recommendations', path: '/recommendations', icon: '💡' },
        { name: 'Agent Control', path: '/agents', icon: '🤖' },
        { name: 'Security Checklist', path: '/checklist', icon: '✅' },
      ],
    },
    { name: 'Settings', path: '/settings', icon: '⚙️' },
    ...(isAdmin ? [{ name: 'Admin Portal', path: '/admin', icon: '🔧' }] : []),
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="w-64 bg-gray-900 text-gray-300 h-screen fixed left-0 top-0 overflow-y-auto">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <span className="text-xl font-bold text-white">Secure Habit</span>
        </div>
      </div>

      <div className="p-2">
        {navItems.map((item) => (
          <div key={item.name}>
            {item.children ? (
              <>
                <button
                  onClick={() => toggleSection(item.name.toLowerCase())}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md hover:bg-gray-800 transition-colors ${
                    expandedSections.has(item.name.toLowerCase()) ? 'bg-gray-800' : ''
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <span>{item.icon}</span>
                    <span className="text-sm font-medium">{item.name}</span>
                  </div>
                  <span className="text-xs">
                    {expandedSections.has(item.name.toLowerCase()) ? '▲' : '▼'}
                  </span>
                </button>
                {expandedSections.has(item.name.toLowerCase()) && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children.map((child) => (
                      <Link
                        key={child.path}
                        to={child.path}
                        className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                          isActive(child.path)
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-800 text-gray-400'
                        }`}
                      >
                        <span>{child.icon}</span>
                        <span>{child.name}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <Link
                to={item.path}
                className={`flex items-center space-x-2 px-3 py-2 rounded-md transition-colors ${
                  isActive(item.path)
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-800 text-gray-300'
                }`}
              >
                <span>{item.icon}</span>
                <span className="text-sm font-medium">{item.name}</span>
              </Link>
            )}
          </div>
        ))}
      </div>

      <div className="absolute bottom-0 w-full p-4 border-t border-gray-800">
        <div className="flex items-center space-x-2 text-sm">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
            {user?.firstName?.[0] || user?.email?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">
              {user?.firstName || user?.email}
            </p>
            <p className="text-gray-400 text-xs truncate">{user?.email}</p>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default SideNav;

