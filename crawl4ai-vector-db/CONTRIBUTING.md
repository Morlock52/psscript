# Contributing to Crawl4AI Vector Database

Thank you for considering contributing to Crawl4AI Vector Database! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with the following information:

- A clear, descriptive title
- A detailed description of the bug
- Steps to reproduce the bug
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Environment information (OS, Node.js version, etc.)

### Suggesting Features

If you have an idea for a new feature, please create an issue on GitHub with the following information:

- A clear, descriptive title
- A detailed description of the feature
- Why the feature would be useful
- Any implementation ideas you have

### Pull Requests

1. Fork the repository
2. Create a new branch for your changes
3. Make your changes
4. Run tests to ensure your changes don't break existing functionality
5. Submit a pull request

## Development Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/crawl4ai-vector-db.git
cd crawl4ai-vector-db
```

2. Install dependencies:

```bash
npm install
```

3. Run the setup script:

```bash
npm run setup-all
```

4. Start the server in development mode:

```bash
npm run start-dev
```

## Project Structure

- `src/models`: Database models using Sequelize
- `src/services`: Business logic services
- `src/routes`: API routes
- `src/cli`: Command-line tools
- `src/config`: Configuration files
- `bin`: Helper scripts

## Testing

Run tests with:

```bash
npm test
```

## Coding Standards

- Use ESLint for code linting
- Follow the existing code style
- Write clear, descriptive commit messages
- Document new code with JSDoc comments
- Write tests for new functionality

## License

By contributing to this project, you agree that your contributions will be licensed under the project's MIT license.
