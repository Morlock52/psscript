"""
LangChain Agent Implementation

This module implements advanced agentic capabilities using LangChain,
enabling autonomous reasoning, planning, and execution with real-time
internet data access.
"""

import os
import logging
from typing import Dict, List, Optional

from langchain.agents.agent import AgentType, initialize_agent, load_tools
from langchain.agents.agent import AgentExecutor
from langchain.memory import ConversationBufferMemory
from langchain.chat_models import ChatOpenAI
from langchain.callbacks.manager import CallbackManager
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler
from langchain.utilities import GoogleSearchAPIWrapper
from langchain.tools import DuckDuckGoSearchRun

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("langchain_agent")

class LangChainAgent:
    """
    LangChain-based agent with advanced capabilities for autonomous reasoning,
    planning, and execution with access to external data sources.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the LangChain agent.
        
        Args:
            api_key: OpenAI API key (optional, will use environment variable if not provided)
        """
        # Set API key
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is required")
        
        # Initialize components
        self.llm = self._initialize_llm()
        self.memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
        self.tools = self._initialize_tools()
        self.agent = self._initialize_agent()
        
        logger.info("LangChain agent initialized")
    
    def _initialize_llm(self) -> ChatOpenAI:
        """Initialize the language model."""
        callback_manager = CallbackManager([StreamingStdOutCallbackHandler()])
        
        return ChatOpenAI(
            openai_api_key=self.api_key,
            temperature=0.7,
            model_name="gpt-4o",
            streaming=True,
            callback_manager=callback_manager,
            verbose=True
        )
    
    def _initialize_tools(self) -> List[BaseTool]:
        """Initialize the tools available to the agent."""
        try:
            # Basic tools
            tools = load_tools(
                ["llm-math", "requests_all"],
                llm=self.llm
            )
            
            # Add search tools if API keys are available
            if os.getenv("GOOGLE_CSE_ID") and os.getenv("GOOGLE_API_KEY"):
                search = GoogleSearchAPIWrapper()
                tools.extend(load_tools(["google-search"], search=search))
            else:
                # Fallback to DuckDuckGo which doesn't require API keys
                tools.append(DuckDuckGoSearchRun())
            
            # Add Wikipedia tool
            tools.extend(load_tools(["wikipedia"]))
            logger.info(f"Initialized {len(tools)} tools for the agent")
            return tools
            
        except Exception as e:
            logger.error(f"Error initializing tools: {e}")
            # Return basic tools if there's an error
            return load_tools(["llm-math"], llm=self.llm)
    
    def _initialize_agent(self) -> AgentExecutor:
        """Initialize the agent with tools and memory."""
        return initialize_agent(
            tools=self.tools,
            llm=self.llm,
            agent=AgentType.CHAT_CONVERSATIONAL_REACT_DESCRIPTION,
            memory=self.memory,
            verbose=True,
            max_iterations=10,
            early_stopping_method="generate",
            handle_parsing_errors=True
        )
    
    async def process_message(self, messages: List[Dict[str, str]]) -> str:
        """
        Process a message using the LangChain agent.
        
        Args:
            messages: List of message dictionaries with 'role' and 'content' keys
            
        Returns:
            The agent's response as a string
        """
        try:
            # Convert messages to LangChain format
            
            # Extract the last user message
            user_message = None
            for msg in reversed(messages):
                if msg["role"] == "user":
                    user_message = msg["content"]
                    break
            
            if not user_message:
                return "I don't see a question. How can I help you?"
            
            # Run the agent
            logger.info(f"Running agent with input: {user_message[:50]}...")
            response = self.agent.run(input=user_message)
            logger.info(f"Agent response generated: {len(response)} chars")
            
            return response
            
        except Exception as e:
            logger.error(f"Error processing message with LangChain agent: {e}")
            return f"I encountered an error while processing your request: {str(e)}"
    
    def reset_memory(self) -> None:
        """Reset the agent's memory."""
        self.memory = ConversationBufferMemory(memory_key="chat_history", return_messages=True)
        self.agent = self._initialize_agent()
        logger.info("Agent memory reset")


# Example usage
if __name__ == "__main__":
    # Set your API key in the environment
    os.environ["OPENAI_API_KEY"] = "your-api-key-here"
    
    # Create an agent
    agent = LangChainAgent()
    
    # Example messages
    messages = [
        {"role": "user", "content": "Summarize the last PowerShell security update."}
    ]
    
    # Process the message
    import asyncio
    response = asyncio.run(agent.process_message(messages))
    
    print(f"Response: {response}")
