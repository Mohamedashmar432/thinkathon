# 🛡️ Secure Habit - Security Vulnerability Management Platform

A comprehensive, AI-powered security vulnerability scanning and management platform that helps organizations and individuals identify, track, and remediate security vulnerabilities across their devices and software inventory.

#### app - https://securehabit.vercel.app/

#### repo - https://github.com/Mohamedashmar432/thinkathon

## 🎯 Problem Statement

Organizations and individual users lack visibility into their security vulnerabilities and struggle to prioritize remediation efforts. Secure Habit addresses this by providing:

- **Automated vulnerability discovery** across all devices and software
- **AI-powered prioritization** to focus on highest-impact security actions
- **Real-time threat intelligence** to stay informed of emerging vulnerabilities
- **Step-by-step remediation guidance** for fixing security issues
- **Continuous monitoring** through scheduled scans
- **Cross-platform support** for Windows, Linux, and macOS

## 🏗️ Architecture Overview

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (MongoDB)     │
│   Vercel        │    │   Render        │    │   Atlas         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         │              │  AI Gateway     │              │
         └──────────────►│  Gemini/Groq   │◄─────────────┘
                        │  OpenAI         │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │ Threat Intel    │
                        │ NVD/CISA KEV    │
                        └─────────────────┘
```

### Technology Stack

**Frontend**
- React 18 with TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- React Router (navigation)
- Axios (HTTP client)
- Recharts (data visualization)

**Backend**
- Node.js with Express
- MongoDB with Mongoose ODM
- TypeScript
- JWT authentication
- WebSocket (real-time communication)
- Google Generative AI (Gemini)


**Infrastructure**
- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas


## 🚀 Features

### 1. 🤖 Cross-Platform Agent System
- **Multi-OS Support**: Windows (PowerShell/Batch), Linux (Bash), macOS (Bash)
- **Agent Lifecycle**: Download → Install → Register → Heartbeat → Scan → Uninstall
- **Real-time Communication**: WebSocket-based agent-to-server communication
- **Remote Commands**: Scan initiation, health checks, software uninstall
- **Status Tracking**: Installed, Connected, Scanning, Active, Inactive, Uninstalled

### 2. 🔍 Comprehensive Vulnerability Scanning
- **System Information**: OS, architecture, manufacturer, model detection
- **Software Inventory**: Installed applications with versions and publishers
- **Browser Extensions**: Chrome, Firefox, Edge extension detection
- **Patch Status**: Windows update tracking
- **Vulnerability Analysis**: CVE matching, CVSS scoring, exploitability assessment
- **Scan Types**: Quick scan, Full scan, Health check

### 3. 📊 Security Scoring System
- **User Secure Score** (0-100): Overall security posture
- **Endpoint Exposure Score** (0-100): Network exposure risk
- **Vulnerability Metrics**: Critical, High, Medium, Low severity counts
- **Exploitable Vulnerabilities**: Tracks actively exploitable CVEs
- **Historical Trends**: Score tracking over time

### 4. 🧠 AI-Powered Recommendations
- **Personalized Suggestions**: Based on user's specific vulnerabilities and software
- **Multi-Provider AI**: Gemini API with Groq and OpenAI fallback
- **Template-Based**: Pre-defined security best practices
- **Priority Levels**: High, Medium, Low based on risk impact
- **Time Estimates**: Estimated remediation time for each recommendation
- **Risk Reduction Metrics**: Expected security improvement from each action

### 5. 🌐 Real-Time Threat Intelligence
- **Live Threat Feeds**: NVD (National Vulnerability Database) and CISA KEV
- **Hourly Updates**: Automatic threat database ingestion
- **Threat Correlation**: Matches threats to user's specific devices
- **Risk Scoring**: CVSS-based impact calculation
- **Action Recommendations**: Specific remediation steps for each threat
- **Exploited Vulnerability Tracking**: Identifies actively exploited CVEs

### 6. 📈 Dashboard & Analytics
- **Security Overview**: Current scores and vulnerability counts
- **Exposure Timeline**: Historical security score trends
- **Top Vulnerable Endpoints**: Network endpoints with most vulnerabilities
- **Top Vulnerable Software**: Software with most CVEs across devices
- **Vulnerability Insights**: Breakdown by severity and category
- **Daily Security Checklist**: Gamified security tasks

### 7. ⏰ Scheduled Scans
- **Recurring Scans**: Cron-based scheduling
- **Automatic Execution**: Runs without user intervention
- **Result Processing**: Automatic analysis and recommendation generation

### 8. 🛠️ Admin Portal
- **System Troubleshooting**: Diagnostic tools
- **System Logs**: Event and error tracking
- **User Management**: Administrative functions

## 📡 API Endpoints

### Authentication (`/api/auth`)
```
POST /signup          - User registration
POST /login           - User login
GET  /me              - Get current user profile
```

### Scanner (`/api/scanner`)
```
POST /generate        - Generate personalized scanner script
GET  /credentials     - Get API credentials for agents
```

### Scans (`/api/scan`)
```
POST /submit          - Submit scan data (API key auth)
GET  /scans           - Get all user scans
GET  /scans/:scanId   - Get detailed scan results
```

### Dashboard (`/api/dashboard`)
```
GET /stats                          - Dashboard statistics
GET /endpoint-exposure-timeline     - Security score timeline
GET /top-endpoints                  - Top vulnerable endpoints
GET /top-vulnerable-software        - Top vulnerable software
GET /vulnerability-insights         - Vulnerability breakdown
GET /top-remediation-activities     - Prioritized remediation tasks
GET /daily-checklist               - Daily security checklist
PUT /daily-checklist/:itemId       - Update checklist item
```

### Agents (`/api/agent`)
```
POST /register                      - Register new agent
POST /:deviceId/heartbeat          - Agent heartbeat
GET  /                             - Get all user agents
GET  /:deviceId                    - Get agent details
POST /:deviceId/quick-scan         - Initiate quick scan
POST /:deviceId/full-scan          - Initiate full scan
POST /:deviceId/uninstall          - Uninstall software
POST /:deviceId/health-check       - Agent health check
POST /:deviceId/uninstall-agent    - Uninstall agent
POST /download-installer           - Download agent installer
GET  /stats/overview               - Agent statistics
```

### Recommendations (`/api/recommendations`)
```
GET /                 - Get personalized security recommendations
```

### Threat Intelligence (`/api/threat-feed`)
```
GET /                 - Get real-time threat intelligence data
```

### Scheduled Scans (`/api/scheduled-scans`)
```
GET    /              - Get scheduled scans
POST   /              - Create scheduled scan
PUT    /:id           - Update scheduled scan
DELETE /:id           - Delete scheduled scan
```

### AI Gateway (`/api/ai-gateway`)
```
POST /generate        - Generate AI-powered responses
GET  /health          - AI Gateway health status
GET  /stats           - AI Gateway statistics
```

### Admin (`/api/admin`)
```
GET /troubleshoot     - System diagnostic information
GET /logs             - System logs
```

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 18+ 
- MongoDB (local or Atlas)
- npm or yarn

### Backend Setup

1. **Clone and navigate to backend**
```bash
cd backend
npm install
```

2. **Environment Configuration**
```bash
cp .env.production.example app.env
# Edit app.env with your configuration
```

3. **Required Environment Variables**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/securehabit
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters
GEMINI_API_KEY_1=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key (optional)
OPENAI_API_KEY=your-openai-api-key (optional)
FRONTEND_URL=http://localhost:5173
```

4. **Start Backend**
```bash
npm run dev
```

### Frontend Setup

1. **Navigate to frontend**
```bash
cd frontend
npm install
```

2. **Environment Configuration**
```bash
cp .env.production.example .env.local
# Edit .env.local with your backend URL
```

3. **Start Frontend**
```bash
npm run dev
```

### Database Setup

**Local MongoDB**
```bash
# Install MongoDB locally or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

**MongoDB Atlas (Recommended)**
1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create cluster (M0 free tier available)
3. Create database user
4. Configure network access (0.0.0.0/0 for development)
5. Get connection string

## 🚀 Deployment

### Production Deployment

**Frontend (Vercel)**
1. Connect GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

**Backend (Render)**
1. Connect GitHub repository to Render
2. Configure environment variables
3. Set build command: `npm run build`
4. Set start command: `npm start`

**Database (MongoDB Atlas)**
1. Create production cluster
2. Configure security and network access
3. Update connection string in production environment


## 🔧 Development  ->  80 % vibe coding 

### Project Structure
```
thinkathon/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── contexts/       # React contexts
│   │   └── utils/          # Utility functions
│   └── package.json
├── backend/                 # Node.js backend
│   ├── src/
│   │   ├── models/         # MongoDB models
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── utils/          # Utility functions
│   │   └── templates/      # Agent templates
│   └── package.json
├── shared/                  # Shared TypeScript types
└── package.json
```

### Key Services

**AI Gateway** (`backend/src/services/ai/aiGateway.ts`)
- Multi-provider AI request handling
- Automatic failover (Gemini → Groq → OpenAI)
- Rate limit management
- Request statistics

**Threat Intelligence** (`backend/src/services/threatIntelService.ts`)
- NVD and CISA KEV data ingestion
- Threat correlation with user devices
- Risk scoring and recommendations

**Recommendation Engine** (`backend/src/services/recommendationEngine.ts`)
- AI-powered security recommendations
- Template-based recommendations
- Priority scoring and deduplication

### Testing

**Backend Testing**
```bash
cd backend
npm test
```

**Frontend Testing**
```bash
cd frontend
npm test
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **API Key Authentication**: For agent communication
- **Rate Limiting**: Protection against abuse
- **CORS Configuration**: Production-ready CORS setup
- **Password Hashing**: bcrypt with salt
- **Environment Variables**: Secure secrets management
- **Input Validation**: Request validation and sanitization

## 📊 Monitoring & Observability

- **Health Checks**: `/health` endpoint with detailed status
- **System Logs**: Comprehensive logging system
- **Keep-Alive System**: Prevents service hibernation
- **Statistics Tracking**: AI Gateway and system metrics
- **Error Logging**: Detailed error tracking and reporting



## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `/docs` folder
- Review the troubleshooting guides in the admin portal

---

**Secure Habit** - Making security accessible, actionable, and automated. 🛡️
