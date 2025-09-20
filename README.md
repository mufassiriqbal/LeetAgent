# LeetCode Agent

An intelligent Chrome extension and Python backend that automates your LeetCode workflow with GitHub integration, AI-powered analysis, and smart notifications.

## Features 

### 🚀 Core Functionality
- **Automatic Solution Extraction**: Extract problem details and your solution code from LeetCode pages
- **GitHub Integration**: Push solutions directly to your GitHub repository with proper organization
- **AI-Powered Analysis**: Get intelligent feedback and optimization suggestions using OpenAI
- **Smart Notifications**: Receive daily summaries and progress reports via email
- **Progress Tracking**: Monitor your coding journey with detailed statistics

### 🤖 AI Features
- Solution review and feedback
- Complexity analysis (time/space)
- Optimization suggestions
- Problem difficulty estimation
- Algorithm explanations
- Test case generation

### 📊 Analytics & Tracking
- Daily/weekly progress reports
- Language usage statistics
- Difficulty distribution analysis
- Solving streaks and patterns
- Performance insights

### 📧 Notifications
- Solution push confirmations
- Daily summary emails
- Weekly progress reports
- Problem-solving reminders
- Error notifications

## Installation

### Prerequisites
- Python 3.8+
- Chrome browser
- GitHub account
- OpenAI API key (optional, for AI features)
- Email account with app password (optional, for notifications)

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/leetcode-agent.git
   cd leetcode-agent
   ```

2. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Configure GitHub OAuth App**
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Create a new OAuth App with:
     - Application name: `LeetCode Agent`
     - Homepage URL: `http://localhost:5000`
     - Authorization callback URL: `http://localhost:5000/callback`
   - Copy Client ID and Client Secret to your `.env` file

5. **Start the backend server**
   ```bash
   python server.py
   ```

### Chrome Extension Setup

1. **Enable Developer Mode**
   - Open Chrome → Extensions → Developer mode ON

2. **Load the Extension**
   - Click "Load unpacked"
   - Select the project directory
   - The extension should appear in your browser

3. **Configure the Extension**
   - Click the extension icon
   - Log in with GitHub
   - Configure your preferences

## Usage

### Basic Workflow

1. **Navigate to any LeetCode problem**
2. **Write your solution** in the code editor
3. **Click the floating action button** (green circle) that appears
4. **Choose an action**:
   - Extract Problem: Get structured problem data
   - Push to GitHub: Save solution to your repository
   - Analyze Solution: Get AI feedback
   - Get Hints: Receive optimization suggestions

### Advanced Features

#### Scheduled Tasks
```python
from scheduler import LeetCodeScheduler

scheduler = LeetCodeScheduler()

# Schedule daily summary at 6 PM
scheduler.schedule_daily_summary("your@email.com", "18:00")

# Schedule weekly reports on Sunday at 7 PM  
scheduler.schedule_weekly_report("your@email.com", "sunday", "19:00")

# Schedule problem reminders on weekdays at 9 AM
scheduler.schedule_problem_reminder("your@email.com", "weekdays", "09:00")

scheduler.start()
```

#### AI Analysis
```python
from aiml_client import AIMLClient

ai = AIMLClient()

# Analyze a problem
analysis = ai.analyze_problem(problem_text, "Medium")

# Review a solution
feedback = ai.review_solution(problem_text, solution_code, "python")

# Get optimization suggestions
suggestions = ai.suggest_optimizations(solution_code, "python")
```

#### GitHub Integration
```python
from github_client import GitHubClient

github = GitHubClient(access_token)

# Push solution with metadata
result = github.push_leetcode_solution({
    "title": "Two Sum",
    "difficulty": "Easy",
    "content": "def twoSum(nums, target):\n    # solution",
    "language": "python",
    "url": "https://leetcode.com/problems/two-sum/"
})
```

## Configuration

### Environment Variables

Create a `.env` file with the following variables:

```bash
# Required
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Optional (for AI features)
OPENAI_API_KEY=your_openai_key

# Optional (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_USE_TLS=true

# Flask settings
SECRET_KEY=your_secret_key
DEBUG=false
```

### Extension Settings

Access settings through the extension popup:
- Repository name (default: `leetcode-solutions`)
- Notification preferences
- AI analysis options
- Automatic push settings

## Repository Structure

```
leetcode-agent/
├── backend/
│   ├── server.py              # Flask API server
│   ├── github_client.py       # GitHub API integration
│   ├── aiml_client.py         # OpenAI integration
│   ├── email_client.py        # Email notifications
│   ├── scheduler.py           # Task scheduling
│   └── config.py              # Configuration management
├── extension/
│   ├── manifest.json          # Extension manifest
│   ├── background.js          # Background script
│   ├── content.js            # LeetCode page integration
│   ├── popup.html            # Extension popup UI
│   ├── popup.js              # Popup logic
│   └── styles.css            # Popup styles
├── data/                      # Generated data directory
├── backups/                   # Repository backups
├── requirements.txt           # Python dependencies
├── .env.example              # Environment template
└── README.md                 # This file
```

## API Endpoints

### Authentication
- `POST /callback` - GitHub OAuth callback
- `GET /status` - Check authentication status
- `POST /logout` - Clear tokens

### Solution Management  
- `POST /push` - Push solution to GitHub
- `GET /stats` - Get user statistics

### AI Integration
- `POST /analyze` - Analyze solution with AI
- `POST /optimize` - Get optimization suggestions
- `POST /explain` - Get algorithm explanations

## Troubleshooting

### Common Issues

1. **Extension not loading**
   - Check that Developer Mode is enabled
   - Verify all files are in the correct directory
   - Check browser console for errors

2. **GitHub authentication fails**
   - Verify OAuth app configuration
   - Check Client ID/Secret in `.env`
   - Ensure callback URL matches

3. **Backend server not starting**
   - Install all requirements: `pip install -r requirements.txt`
   - Check Python version (3.8+ required)
   - Verify environment variables

4. **AI features not working**
   - Verify OpenAI API key is valid
   - Check API usage limits
   - Ensure sufficient credits

5. **Email notifications not sent**
   - Use app-specific password for Gmail
   - Check SMTP settings
   - Verify firewall/network settings

### Debug Mode

Enable debug logging:
```bash
export DEBUG=true
python server.py
```

### Testing

Test individual components:
```bash
# Test GitHub connection
python -c "from github_client import GitHubClient; print('GitHub OK')"

# Test AI features  
python -c "from aiml_client import AIMLClient; print('AI OK')"

# Test email
python -c "from email_client import EmailClient; client = EmailClient(); print(client.test_connection())"
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Security

- Never commit API keys or secrets
- Use environment variables for sensitive data
- Regularly rotate OAuth tokens
- Keep dependencies updated

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

- Create an issue for bug reports
- Star the repository if you find it useful
- Share feedback and feature requests

## Roadmap

### Upcoming Features
- [ ] Multiple repository support
- [ ] Solution templates and snippets
- [ ] Contest participation tracking
- [ ] Team collaboration features
- [ ] Mobile app integration
- [ ] Advanced analytics dashboard
- [ ] Integration with other coding platforms

### Version History
- **v1.0.0** - Initial release with core features
- **v1.1.0** - AI integration and analysis
- **v1.2.0** - Advanced scheduling and notifications
- **v1.3.0** - Enhanced UI and user experience

---

**Happy Coding!** 🚀

Built with ❤️ for the LeetCode community.
