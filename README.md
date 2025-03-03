# PowerShell Script Management Application

A comprehensive platform for managing, analyzing, and executing PowerShell scripts with AI-enhanced capabilities.

![PS Script Banner](https://example.com/banner.png)

## 🚀 Features

- **AI-Powered Analysis**: Automatically analyzes scripts for purpose, security risks, and code quality
- **PowerShell AI Chat**: Interactive chat interface with a PowerShell AI assistant
- **Semantic Search**: Find scripts by natural language queries, not just keywords
- **Version Control**: Track changes to scripts over time with full history
- **Intelligent Categorization**: Auto-categorizes scripts into 20 predefined categories
- **Interactive Execution**: Run scripts with parameter validation in a secure environment
- **Role-Based Access**: Granular permissions for different user roles
- **Responsive UI**: Modern interface that works on desktop and mobile devices
- **Performance Optimization**: Redis caching and efficient database queries
- **Dark/Light Theme**: Supports both dark and light modes
- **Chat History**: Persistent chat history with the ability to search past conversations

## 📋 Prerequisites

- [Docker](https://www.docker.com/get-started) and Docker Compose
- [Node.js](https://nodejs.org/) v14 or later
- [Python](https://www.python.org/) 3.8 or later
- [OpenAI API Key](https://platform.openai.com/)
- [PostgreSQL](https://www.postgresql.org/) 13 or later with pgvector extension
- At least 5GB of free disk space for installation and dependencies

## 🛠️ Installation

### Option 1: Using Docker (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/psscript.git
   cd psscript
   ```

2. Create an `.env` file with your configuration:
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

3. Build and start all services:
   ```bash
   docker-compose up -d
   ```
   
   Or start just the frontend for development:
   ```bash
   docker-compose up -d frontend
   ```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000
   - AI Service: http://localhost:8000
   
5. View logs:
   ```bash
   # View all logs
   docker-compose logs
   
   # Follow frontend logs
   docker-compose logs -f frontend
   ```
   
6. Stop the services:
   ```bash
   docker-compose down
   ```

### Option 2: Manual Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/psscript.git
   cd psscript
   ```

2. Run the setup script:
   ```bash
   ./setup.sh
   ```

3. Start the frontend:
   ```bash
   cd src/frontend
   npm run dev
   ```

4. Start the backend:
   ```bash
   cd src/backend
   npm run dev
   ```

5. Start the AI service:
   ```bash
   cd src/ai
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   python -m uvicorn main:app --reload
   ```

## 📚 Project Structure

```
psscript/
├── docker-compose.yml     # Docker configuration
├── setup.sh               # Setup script
├── src/
│   ├── frontend/          # React/TypeScript UI
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Application pages
│   │   ├── services/      # API service layer
│   │   └── hooks/         # Custom React hooks
│   ├── backend/           # Node.js/Express API
│   │   ├── controllers/   # Request handlers
│   │   ├── middleware/    # Express middleware
│   │   ├── models/        # Database models
│   │   └── routes/        # API routes
│   ├── ai/                # Python AI service
│   │   ├── analysis/      # Script analysis logic
│   │   ├── embeddings/    # Vector embedding generation
│   │   └── main.py        # FastAPI application
│   ├── db/                # Database
│   │   ├── migrations/    # Database migrations
│   │   ├── schema.sql     # Database schema
│   │   └── seeds/         # Seed data
│   └── powershell/        # PowerShell modules
│       ├── modules/       # Custom PowerShell modules
│       └── integrations/  # Integration scripts
```

## 🧠 AI Capabilities

The application utilizes OpenAI models to provide advanced analysis of PowerShell scripts:

- **Code Quality Assessment**: Evaluates script quality on a 1-10 scale
- **Security Analysis**: Identifies potential security issues and vulnerabilities
- **Purpose Identification**: Determines the main function and use case of the script
- **Parameter Documentation**: Automatically documents script parameters and their usage
- **Similar Script Finding**: Identifies similar scripts using vector similarity
- **Categorization**: Assigns scripts to the most appropriate category
- **Optimization Suggestions**: Provides specific recommendations for improvement
- **AI-Enhanced Script Management**: Analyze scripts and automatically implement suggested improvements
- **Automatic Code Refactoring**: Apply best practices and improve code quality with one click
- **Bulk AI Analysis**: Process multiple scripts at once for efficiency
- **Selectable AI Models**: Choose from various AI models including GPT-4, GPT-3.5 Turbo, and Claude models to balance performance and speed

## 🔌 API Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/auth/register` | Register a new user |
| POST   | `/api/auth/login` | Log in and get authentication token |
| POST   | `/api/auth/refresh` | Refresh authentication token |
| GET    | `/api/auth/me` | Get current user information |

### Script Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/scripts` | List all scripts with pagination and filtering |
| GET    | `/api/scripts/:id` | Get a specific script by ID |
| POST   | `/api/scripts` | Create a new script |
| PUT    | `/api/scripts/:id` | Update an existing script |
| DELETE | `/api/scripts/:id` | Delete a script |
| GET    | `/api/scripts/search` | Search scripts by keyword or query |
| GET    | `/api/scripts/:id/analysis` | Get AI analysis for a script |
| POST   | `/api/scripts/:id/execute` | Execute a script with parameters |
| GET    | `/api/scripts/:id/similar` | Find similar scripts |
| POST   | `/api/scripts/analyze` | Analyze a script without saving |
| GET    | `/api/scripts/:id/versions` | Get script version history |

### Category and Tag Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/categories` | List all categories |
| GET    | `/api/categories/:id/scripts` | Get scripts in a category |
| GET    | `/api/tags` | List all tags |
| POST   | `/api/tags` | Create a new tag |
| GET    | `/api/tags/:id/scripts` | Get scripts with a specific tag |

### Analytics Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/analytics/usage-stats` | Get usage statistics |
| GET    | `/api/analytics/security-metrics` | Get security metrics |
| GET    | `/api/analytics/category-distribution` | Get category distribution |

### Chat Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | `/api/chat` | Send a message to the PowerShell AI assistant |
| GET    | `/api/chat/history` | Get chat history for the current user |
| POST   | `/api/chat/history` | Save chat history |
| DELETE | `/api/chat/history` | Clear chat history |
| GET    | `/api/chat/history/search` | Search chat history by query |

## 🖥️ Environment Variables

The application uses the following environment variables:

### Frontend (`.env` in `src/frontend`)

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:4000/api` |
| `VITE_AI_SERVICE_URL` | AI service URL for chat | `http://localhost:8000` |
| `VITE_USE_MOCKS` | Use mock data instead of real API | `false` |

### Backend (`.env` in root)

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port for the backend server | `4000` |
| `NODE_ENV` | Environment (development/production) | `development` |
| `DB_HOST` | PostgreSQL database host | `postgres` |
| `DB_PORT` | PostgreSQL database port | `5432` |
| `DB_NAME` | PostgreSQL database name | `psscript` |
| `DB_USER` | PostgreSQL username | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `postgres` |
| `REDIS_URL` | Redis URL for caching | `redis://redis:6379` |
| `JWT_SECRET` | Secret for JWT tokens | - |
| `AI_SERVICE_URL` | URL for the AI service | `http://ai-service:8000` |

### AI Service (`.env` in root)

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | - |
| `MOCK_MODE` | Use mock responses instead of real AI | `false` |
| `DB_HOST` | PostgreSQL database host | `postgres` |
| `DB_PORT` | PostgreSQL database port | `5432` |
| `DB_NAME` | PostgreSQL database name | `psscript` |
| `DB_USER` | PostgreSQL username | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `postgres` |

## 📱 User Interface

The application includes the following main pages:

- **Dashboard**: Overview of script stats and recent activity
- **Search**: Advanced search interface with filters
- **Script Upload**: Form to upload and analyze new scripts
- **Script Detail**: View script details, analysis, and execution options
- **Chat**: Interactive chat with a PowerShell AI assistant for scripting help
- **Manage Files**: Bulk management of scripts with AI-enhanced improvement suggestions
- **Analytics**: Visualizations of script data and usage
- **Categories**: Browse scripts by category
- **User Profile**: User settings and preferences
- **Application Settings**: Configure AI models, database mode, and advanced features

## 🛡️ Security

The application implements several security measures:

- JWT-based authentication
- Role-based access control
- Input validation
- API rate limiting
- Security headers
- Secure password storage with bcrypt
- XSS protection
- CSRF protection

## 🔧 Troubleshooting

### Common Issues

#### Insufficient Disk Space
- The application requires at least 5GB of free disk space for installation and running
- If you encounter "No space left on device" errors during setup or while building containers, free up disk space
- Check available space with `df -h` command
- For Python dependency errors, try using prebuilt wheels instead of building from source

#### Switching Between Mock and Production Database
- You can toggle between the mock database (for development/testing) and the production database
- Enable this feature in Application Settings (Settings > Application Settings > Database Toggle Button)
- Once enabled, a floating toggle button will appear at the bottom-right corner of the screen
- This is useful for testing features without impacting production data

#### Frontend Not Loading
- Ensure the frontend service is running (`docker-compose ps`)
- Check for JavaScript console errors
- Verify the API URL in the frontend environment

#### Backend API Errors
- Check the backend logs (`docker-compose logs backend`)
- Verify database connection
- Ensure Redis is running for caching

#### AI Analysis Not Working
- Verify your OpenAI API key is correctly set
- Check the AI service logs (`docker-compose logs ai-service`)
- Ensure the backend can reach the AI service

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [OpenAI](https://openai.com/) for their powerful AI models
- [React](https://reactjs.org/) and [TypeScript](https://www.typescriptlang.org/) for the frontend
- [Express](https://expressjs.com/) for the backend API
- [FastAPI](https://fastapi.tiangolo.com/) for the AI service
- [PostgreSQL](https://www.postgresql.org/) and [pgvector](https://github.com/pgvector/pgvector) for the database
- [PowerShell](https://github.com/PowerShell/PowerShell) core team