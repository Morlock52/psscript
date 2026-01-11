"""
LangChain Agent Implementation - Updated January 2026 for LangGraph 1.0

This module implements advanced agentic capabilities using LangGraph,
enabling autonomous reasoning, planning, and execution with real-time
internet data access.
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional, Union

# LangGraph 1.0 imports - January 2026
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver

# LangChain core imports
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from langchain_core.tools import BaseTool, tool
from langchain_community.tools import DuckDuckGoSearchRun
from langchain_community.utilities import WikipediaAPIWrapper
from langchain_community.tools import WikipediaQueryRun

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("langchain_agent")


class LangChainAgent:
    """
    LangGraph-based agent with advanced capabilities for autonomous reasoning,
    planning, and execution with access to external data sources.
    """

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the LangGraph agent.

        Args:
            api_key: OpenAI API key (optional, will use environment variable if not provided)
        """
        # Set API key
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OpenAI API key is required")

        # Initialize components
        self.llm = self._initialize_llm()
        self.tools = self._initialize_tools()
        self.checkpointer = MemorySaver()  # For conversation memory
        self.agent = self._initialize_agent()
        self.thread_id = "default"  # For memory persistence

        logger.info("LangGraph agent initialized")

    def _initialize_llm(self) -> ChatOpenAI:
        """Initialize the language model."""
        return ChatOpenAI(
            api_key=self.api_key,
            temperature=0.7,
            model="gpt-4o",
            streaming=True,
        )

    def _initialize_tools(self) -> List[BaseTool]:
        """Initialize the tools available to the agent."""
        tools = []

        try:
            # DuckDuckGo search - no API key required
            tools.append(DuckDuckGoSearchRun())

            # Wikipedia tool
            wikipedia = WikipediaAPIWrapper()
            tools.append(WikipediaQueryRun(api_wrapper=wikipedia))

            # Add calculator tool
            tools.append(self._create_calculator_tool())

            logger.info(f"Initialized {len(tools)} tools for the agent")
            return tools

        except Exception as e:
            logger.error(f"Error initializing tools: {e}")
            # Return minimal tools if there's an error
            return [self._create_calculator_tool()]

    def _create_calculator_tool(self) -> BaseTool:
        """Create a simple calculator tool."""
        @tool
        def calculator(expression: str) -> str:
            """Evaluate a mathematical expression. Input should be a valid Python math expression."""
            try:
                # Safe evaluation of mathematical expressions
                import ast
                import operator

                operators = {
                    ast.Add: operator.add,
                    ast.Sub: operator.sub,
                    ast.Mult: operator.mul,
                    ast.Div: operator.truediv,
                    ast.Pow: operator.pow,
                    ast.USub: operator.neg,
                }

                def _eval(node):
                    if isinstance(node, ast.Num):
                        return node.n
                    elif isinstance(node, ast.Constant):
                        return node.value
                    elif isinstance(node, ast.BinOp):
                        return operators[type(node.op)](_eval(node.left), _eval(node.right))
                    elif isinstance(node, ast.UnaryOp):
                        return operators[type(node.op)](_eval(node.operand))
                    else:
                        raise ValueError(f"Unsupported operation: {type(node)}")

                tree = ast.parse(expression, mode='eval')
                result = _eval(tree.body)
                return str(result)
            except Exception as e:
                return f"Error calculating: {str(e)}"

        return calculator

    def _initialize_agent(self):
        """Initialize the agent with tools using LangGraph 1.0."""
        # System prompt for the agent
        system_message = """You are a helpful AI assistant with access to tools.
Use the tools when needed to answer questions accurately.
Always be helpful and provide detailed, accurate responses.

When you need to search for information, use the duckduckgo_search tool.
When you need to look up facts on Wikipedia, use the wikipedia tool.
When you need to calculate something, use the calculator tool."""

        # Create the ReAct agent using LangGraph
        agent = create_react_agent(
            model=self.llm,
            tools=self.tools,
            prompt=system_message,
            checkpointer=self.checkpointer,
        )

        return agent

    async def process_message(self, messages: List[Dict[str, str]]) -> str:
        """
        Process a message using the LangGraph agent.

        Args:
            messages: List of message dictionaries with 'role' and 'content' keys

        Returns:
            The agent's response as a string
        """
        try:
            # Convert messages to LangChain format
            langchain_messages = []
            for msg in messages:
                if msg["role"] == "user":
                    langchain_messages.append(HumanMessage(content=msg["content"]))
                elif msg["role"] == "assistant":
                    langchain_messages.append(AIMessage(content=msg["content"]))
                elif msg["role"] == "system":
                    langchain_messages.append(SystemMessage(content=msg["content"]))

            if not langchain_messages:
                return "I don't see a question. How can I help you?"

            # Run the agent with thread_id for memory
            logger.info(f"Running agent with {len(langchain_messages)} messages...")

            config = {"configurable": {"thread_id": self.thread_id}}
            result = await self.agent.ainvoke(
                {"messages": langchain_messages},
                config=config
            )

            # Extract the final response
            if result and "messages" in result:
                final_messages = result["messages"]
                if final_messages:
                    last_message = final_messages[-1]
                    if hasattr(last_message, 'content'):
                        response = last_message.content
                        logger.info(f"Agent response generated: {len(response)} chars")
                        return response

            return "I couldn't generate a response. Please try again."

        except Exception as e:
            logger.error(f"Error processing message with LangGraph agent: {e}")
            return f"I encountered an error while processing your request: {str(e)}"

    def reset_memory(self) -> None:
        """Reset the agent's memory by creating a new thread."""
        import uuid
        self.thread_id = str(uuid.uuid4())
        logger.info(f"Agent memory reset, new thread_id: {self.thread_id}")


# Custom tool for weather data
class WeatherTool(BaseTool):
    """Tool for getting weather information."""

    name: str = "weather"
    description: str = "Get current weather information for a location"

    def _run(self, location: str) -> str:
        """Get weather for a location."""
        try:
            import requests

            api_key = os.getenv("OPENWEATHER_API_KEY")
            if not api_key:
                return "OpenWeather API key not configured"

            url = f"http://api.openweathermap.org/data/2.5/weather?q={location}&appid={api_key}&units=metric"
            response = requests.get(url)
            data = response.json()

            if response.status_code != 200:
                return f"Error: {data.get('message', 'Unknown error')}"

            weather = data["weather"][0]["description"]
            temp = data["main"]["temp"]
            feels_like = data["main"]["feels_like"]
            humidity = data["main"]["humidity"]
            wind_speed = data["wind"]["speed"]

            return (
                f"Weather in {location}: {weather}\n"
                f"Temperature: {temp}°C (feels like {feels_like}°C)\n"
                f"Humidity: {humidity}%\n"
                f"Wind Speed: {wind_speed} m/s"
            )

        except Exception as e:
            return f"Error getting weather: {str(e)}"

    async def _arun(self, location: str) -> str:
        """Async implementation of the weather tool."""
        import asyncio
        return await asyncio.to_thread(self._run, location)


# Custom tool for financial data
class FinancialDataTool(BaseTool):
    """Tool for getting financial data."""

    name: str = "financial_data"
    description: str = "Get financial data for a stock symbol"

    def _run(self, symbol: str) -> str:
        """Get financial data for a stock symbol."""
        try:
            import requests

            api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
            if not api_key:
                return "Alpha Vantage API key not configured"

            url = f"https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol={symbol}&apikey={api_key}"
            response = requests.get(url)
            data = response.json()

            if "Global Quote" not in data or not data["Global Quote"]:
                return f"No data found for symbol {symbol}"

            quote = data["Global Quote"]
            price = quote.get("05. price", "N/A")
            change = quote.get("09. change", "N/A")
            change_percent = quote.get("10. change percent", "N/A")

            return (
                f"Financial data for {symbol}:\n"
                f"Price: ${price}\n"
                f"Change: {change} ({change_percent})"
            )

        except Exception as e:
            return f"Error getting financial data: {str(e)}"

    async def _arun(self, symbol: str) -> str:
        """Async implementation of the financial data tool."""
        import asyncio
        return await asyncio.to_thread(self._run, symbol)


# Example usage
if __name__ == "__main__":
    import asyncio

    # Set your API key in the environment
    os.environ["OPENAI_API_KEY"] = "your-api-key-here"

    # Create an agent
    agent = LangChainAgent()

    # Example messages
    messages = [
        {"role": "user", "content": "What is 25 * 17?"}
    ]

    # Process the message
    response = asyncio.run(agent.process_message(messages))
    print(f"Response: {response}")
