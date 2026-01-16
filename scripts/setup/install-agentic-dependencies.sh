#!/bin/bash
# Script to install dependencies for agentic capabilities

echo "Installing dependencies for agentic capabilities..."

# Check if we're in a virtual environment
if [ -z "$VIRTUAL_ENV" ]; then
    echo "Warning: Not running in a virtual environment. It's recommended to use a virtual environment."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation aborted."
        exit 1
    fi
fi

# Install dependencies from requirements.txt
echo "Installing dependencies from requirements.txt..."
pip install -r src/ai/requirements.txt

# Check if LangGraph was installed successfully
if python -c "import langgraph" 2>/dev/null; then
    echo "✅ LangGraph installed successfully"
else
    echo "❌ LangGraph installation failed"
    echo "Attempting to install LangGraph directly..."
    pip install langgraph
    
    if python -c "import langgraph" 2>/dev/null; then
        echo "✅ LangGraph installed successfully on second attempt"
    else
        echo "❌ LangGraph installation failed. Please install manually with 'pip install langgraph'"
    fi
fi

# Check if Py-g was installed successfully
if python -c "import pyg" 2>/dev/null; then
    echo "✅ Py-g installed successfully"
else
    echo "❌ Py-g installation failed"
    echo "Attempting to install Py-g directly..."
    pip install pyg
    
    if python -c "import pyg" 2>/dev/null; then
        echo "✅ Py-g installed successfully on second attempt"
    else
        echo "❌ Py-g installation failed. Please install manually with 'pip install pyg'"
    fi
fi

# Install additional dependencies for testing
echo "Installing additional dependencies for testing..."
pip install pytest pytest-asyncio pytest-cov

echo "Installation completed."
echo "You can now run the tests with 'python test-langgraph-agent.py' and 'python test-pyg-agent.py'"
