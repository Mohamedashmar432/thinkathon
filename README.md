# Thinkathon - Security Vulnerability Scanner

A comprehensive web application for scanning and managing security vulnerabilities across systems.

## Project Structure

```
thinkathon/
├── frontend/          # React + Vite + Tailwind CSS
├── backend/          # Node.js + Express + MongoDB
└── shared/           # Shared TypeScript types
```

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite as build tool
- Tailwind CSS for styling
- React Router for navigation
- Axios for API calls
- Recharts for data visualization

### Backend
- Node.js with Express
- MongoDB with Mongoose
- JWT for authentication
- bcrypt for password hashing
- express-rate-limit for API protection

## Setup Instructions

### Prerequisites
- Node.js 18+ installed
- MongoDB installed and running (or MongoDB Atlas connection string)
- npm or yarn package manager

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file in backend directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/thinkathon
JWT_SECRET=your-super-secret-jwt-key-change-in-production
SECRET_SALT=your-secret-salt-for-api-keys-change-in-production
API_BASE_URL=http://localhost:5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

4. Start MongoDB (if running locally):
```bash
# On Windows
net start MongoDB

# On macOS/Linux
mongod
```

5. Seed the database (optional):
```bash
npm run seed
```

6. Start the backend server:
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Demo Accounts

After running the seed script, you can use these accounts:

- **demo@test.com** / password: `demo123`
- **john@thinkbridge.com** / password: `demo123`
- **sarah@thinkbridge.com** / password: `demo123`

## Features

### Authentication
- User signup and login
- JWT-based authentication
- Protected routes

### Scanner
- Generate personalized PowerShell scanner script
- Download scanner with embedded API credentials
- Submit scan data via API

### Dashboard
- Secure score visualization
- Organization score (for @thinkbridge.com users)
- Endpoint exposure timeline
- Top vulnerable endpoints
- Top vulnerable software
- Vulnerability insights with charts
- Remediation activities
- Daily security checklist

### Scans Management
- View all scans
- Filter by device
- Detailed scan view with vulnerabilities
- Software inventory
- Browser extensions list

### Settings
- User profile management
- API credentials display
- Organization settings (for @thinkbridge.com users)

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Scanner
- `POST /api/scanner/generate` - Generate scanner script
- `GET /api/scanner/credentials` - Get API credentials

### Scans
- `POST /api/scan/submit` - Submit scan data (API key auth)
- `GET /api/scans` - Get all scans
- `GET /api/scans/:scanId` - Get scan details

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/endpoint-exposure-timeline` - Get exposure timeline
- `GET /api/dashboard/top-endpoints` - Get top vulnerable endpoints
- `GET /api/dashboard/top-vulnerable-software` - Get top vulnerable software
- `GET /api/dashboard/vulnerability-insights` - Get vulnerability insights
- `GET /api/dashboard/top-remediation-activities` - Get remediation activities
- `GET /api/dashboard/daily-checklist` - Get daily checklist
- `PUT /api/dashboard/daily-checklist/:itemId` - Update checklist item

### Organization
- `GET /api/organization/score` - Get organization score
- `GET /api/organization/score-history` - Get organization score history

## Development

### Running in Development Mode

1. Start MongoDB
2. Start backend: `cd backend && npm run dev`
3. Start frontend: `cd frontend && npm run dev`

### Building for Production

**Backend:**
```bash
cd backend
npm run build
npm start
```

**Frontend:**
```bash
cd frontend
npm run build
npm run preview
```

## Security Notes

- Change `JWT_SECRET` and `SECRET_SALT` in production
- Use environment variables for all secrets
- Enable HTTPS in production
- Configure CORS properly for production domain
- Use strong passwords in production
- Regularly update dependencies

## License

MIT

