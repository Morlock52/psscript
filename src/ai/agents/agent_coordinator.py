"""
Agent Coordinator for PSScript Platform

This module implements the coordinator agent that orchestrates the multi-agent system
for PowerShell script analysis, categorization, and optimization. It delegates tasks
to specialized agents and combines their results.
"""

import os
import json
import logging
import asyncio
from typing import Dict, List, Any, Optional
import time
from datetime import datetime

# Import agent types
from .enhanced_memory import EnhancedMemorySystem
from .multi_agent_system import (
    MultiAgentSystem, 
    AgentRole, 
    AgentCapability, 
    TaskStatus
)
from .tool_integration import tool_registry
from .task_planning import TaskPlanner
from .state_visualization import StateTracker
from .voice_agent import VoiceAgent
from analysis.script_analyzer import ScriptAnalyzer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("agent_coordinator")

class AgentCoordinator:
    """
    Coordinator for the multi-agent system that orchestrates script analysis,
    categorization, and optimization tasks.
    """
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        memory_storage_path: Optional[str] = None,
        visualization_output_dir: Optional[str] = None,
        model: str = "gpt-4o"  # Updated to gpt-4o for January 2026
    ):
        """
        Initialize the agent coordinator.

        Args:
            api_key: OpenAI API key
            memory_storage_path: Path to store memory
            visualization_output_dir: Directory to save visualizations
            model: Model to use for agents (default: gpt-4o as of January 2026)
        """
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        self.model = model
        if not self.api_key:
            logger.warning("OpenAI API key is not set, some features may not work")
        
        # Initialize the multi-agent system
        self.multi_agent_system = MultiAgentSystem(coordinator_api_key=self.api_key)
        
        # Initialize the task planner
        self.task_planner = TaskPlanner()
        
        # Initialize the state tracker
        self.state_tracker = StateTracker()
        
        # Initialize the memory system
        self.memory_system = EnhancedMemorySystem(
            working_memory_capacity=100,
            long_term_storage_path=memory_storage_path,
            max_episodes=50
        )
        
        # Create specialized agents
        self._create_specialized_agents(model)
        
        # Initialize script analyzer for embeddings
        self.script_analyzer = ScriptAnalyzer(use_cache=True)
        
        # Visualization output directory
        self.visualization_output_dir = visualization_output_dir
        if visualization_output_dir and not os.path.exists(visualization_output_dir):
            os.makedirs(visualization_output_dir)
        
        # Start a new episode in the memory system
        self.memory_system.start_new_episode("Initialization")
        
        logger.info("Agent Coordinator initialized")
    
    def _create_specialized_agents(self, model: str) -> None:
        """
        Create specialized agents for different tasks.
        
        Args:
            model: Model to use for agents
        """
        # Analysis Agent
        self.multi_agent_system.add_agent(
            name="Analysis Agent",
            role=AgentRole.ANALYST,
            capabilities=[
                AgentCapability.SCRIPT_ANALYSIS,
                AgentCapability.REASONING,
                AgentCapability.MEMORY_MANAGEMENT
            ],
            api_key=self.api_key,
            model=model
        )
        
        # Security Agent
        self.multi_agent_system.add_agent(
            name="Security Agent",
            role=AgentRole.SPECIALIST,
            capabilities=[
                AgentCapability.SECURITY_ANALYSIS,
                AgentCapability.REASONING
            ],
            api_key=self.api_key,
            model=model
        )
        
        # Categorization Agent
        self.multi_agent_system.add_agent(
            name="Categorization Agent",
            role=AgentRole.SPECIALIST,
            capabilities=[
                AgentCapability.CATEGORIZATION,
                AgentCapability.REASONING
            ],
            api_key=self.api_key,
            model=model
        )
        
        # Documentation Agent
        self.multi_agent_system.add_agent(
            name="Documentation Agent",
            role=AgentRole.RESEARCHER,
            capabilities=[
                AgentCapability.DOCUMENTATION,
                AgentCapability.TOOL_USE
            ],
            api_key=self.api_key,
            model=model
        )
        
        # Optimization Agent
        self.multi_agent_system.add_agent(
            name="Optimization Agent",
            role=AgentRole.SPECIALIST,
            capabilities=[
                AgentCapability.OPTIMIZATION,
                AgentCapability.CODE_GENERATION,
                AgentCapability.REASONING
            ],
            api_key=self.api_key,
            model=model
        )
        
        # Voice Agent
        voice_agent_id = self.multi_agent_system.add_agent(
            name="Voice Agent",
            role=AgentRole.INTERFACE,
            capabilities=[
                AgentCapability.VOICE_SYNTHESIS,
                AgentCapability.VOICE_RECOGNITION,
                AgentCapability.TOOL_USE
            ],
            api_key=self.api_key,
            model=model
        )
        
        # Create the Voice Agent instance
        self.multi_agent_system.agents[voice_agent_id] = VoiceAgent(
            agent_id=voice_agent_id,
            name="Voice Agent",
            api_key=self.api_key,
            model=model
        )
        
        logger.info("Voice Agent created")
        
        logger.info("Specialized agents created")

    async def synthesize_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        output_format: str = "mp3"
    ) -> Dict[str, Any]:
        """
        Synthesize text into speech using the voice agent.
        
        Args:
            text: Text to synthesize
            voice_id: Voice ID to use
            output_format: Output audio format
            
        Returns:
            Dictionary containing the audio data and metadata
        """
        # Find a voice agent
        voice_agent = None
        for agent_id, agent in self.multi_agent_system.agents.items():
            if AgentCapability.VOICE_SYNTHESIS in agent.capabilities:
                voice_agent = agent
                break
        
        if not voice_agent:
            logger.error("No voice agent found for speech synthesis")
            return {"error": "No voice agent available"}
        
        try:
            # Call the voice agent directly
            if isinstance(voice_agent, VoiceAgent):
                result = await voice_agent.synthesize_speech(
                    text=text,
                    voice_id=voice_id,
                    output_format=output_format
                )
                return result
            else:
                logger.error("Found agent with VOICE_SYNTHESIS capability but it's not a VoiceAgent")
                return {"error": "Invalid voice agent type"}
        except Exception as e:
            logger.error(f"Error in synthesize_speech: {e}")
            return {"error": str(e)}

    async def recognize_speech(
        self,
        audio_data: str,
        language: str = "en-US"
    ) -> Dict[str, Any]:
        """
        Recognize speech from audio data using the voice agent.
        
        Args:
            audio_data: Base64-encoded audio data
            language: Language code
            
        Returns:
            Dictionary containing the recognized text and metadata
        """
        # Find a voice agent
        voice_agent = None
        for agent_id, agent in self.multi_agent_system.agents.items():
            if AgentCapability.VOICE_RECOGNITION in agent.capabilities:
                voice_agent = agent
                break
        
        if not voice_agent:
            logger.error("No voice agent found for speech recognition")
            return {"error": "No voice agent available"}
        
        try:
            # Call the voice agent directly
            if isinstance(voice_agent, VoiceAgent):
                result = await voice_agent.recognize_speech(
                    audio_data=audio_data,
                    language=language
                )
                return result
            else:
                logger.error("Found agent with VOICE_RECOGNITION capability but it's not a VoiceAgent")
                return {"error": "Invalid voice agent type"}
        except Exception as e:
            logger.error(f"Error in recognize_speech: {e}")
            return {"error": str(e)}
    
    async def analyze_script(
        self,
        script_content: str,
        script_name: Optional[str] = None,
        script_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Analyze a PowerShell script using the ScriptAnalyzer directly.

        This method executes analysis directly instead of creating tasks,
        ensuring actual results are returned.

        Args:
            script_content: Content of the script
            script_name: Name of the script
            script_id: ID of the script in the database
            metadata: Additional metadata for the script

        Returns:
            Analysis results including purpose, security, categorization, and optimization
        """
        start_time = time.time()

        # Start a new episode in the memory system
        episode_name = f"Script Analysis: {script_name or script_id or 'Unnamed Script'}"
        self.memory_system.start_new_episode(episode_name)

        # Add script to working memory
        self.memory_system.add_to_working_memory(
            content=script_content,
            memory_type="script",
            source="user",
            importance=0.9
        )

        try:
            # Execute analysis directly using ScriptAnalyzer (which works!)
            logger.info(f"Starting script analysis for {script_name or script_id or 'Unnamed Script'}")

            # Run all analysis tasks concurrently for better performance
            analysis_task = asyncio.create_task(
                self.script_analyzer.analyze_script_async(script_content)
            )
            embedding_task = asyncio.create_task(
                self.script_analyzer.generate_embedding_async(script_content)
            )

            # Also run tool-based analysis in parallel
            security_task = asyncio.create_task(
                self._execute_security_analysis(script_content)
            )
            categorization_task = asyncio.create_task(
                self._execute_categorization(script_content)
            )
            documentation_task = asyncio.create_task(
                self._execute_documentation_search(script_content)
            )

            # Wait for all tasks to complete
            analysis_result, embedding, security_result, categorization_result, documentation_result = await asyncio.gather(
                analysis_task,
                embedding_task,
                security_task,
                categorization_task,
                documentation_task,
                return_exceptions=True
            )

            # Handle any exceptions in results
            if isinstance(analysis_result, Exception):
                logger.error(f"Analysis failed: {analysis_result}")
                analysis_result = {"error": str(analysis_result)}
            if isinstance(embedding, Exception):
                logger.error(f"Embedding generation failed: {embedding}")
                embedding = [0.0] * 3072
            if isinstance(security_result, Exception):
                logger.error(f"Security analysis failed: {security_result}")
                security_result = {"error": str(security_result)}
            if isinstance(categorization_result, Exception):
                logger.error(f"Categorization failed: {categorization_result}")
                categorization_result = {"error": str(categorization_result)}
            if isinstance(documentation_result, Exception):
                logger.error(f"Documentation search failed: {documentation_result}")
                documentation_result = {"error": str(documentation_result)}

            # Combine results
            results = {
                "script_name": script_name,
                "script_id": script_id,
                "analysis_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat(),
                "model": self.model,
                # Main analysis results
                "purpose": analysis_result.get("purpose", "Unknown purpose"),
                "security_analysis": security_result.get("security_issues", analysis_result.get("security_analysis", [])),
                "security_score": security_result.get("security_score", analysis_result.get("security_score", 5.0)),
                "code_quality_score": analysis_result.get("code_quality_score", 5.0),
                "parameters": analysis_result.get("parameters", {}),
                "category": categorization_result.get("category", analysis_result.get("category", "Utilities & Helpers")),
                "category_id": categorization_result.get("category_id", analysis_result.get("category_id", 10)),
                "optimization": analysis_result.get("optimization", []),
                "risk_score": analysis_result.get("risk_score", 5.0),
                "reliability_score": analysis_result.get("reliability_score", 5.0),
                "command_details": analysis_result.get("command_details", []),
                "ms_docs_references": documentation_result.get("references", analysis_result.get("ms_docs_references", [])),
                "embedding_generated": len(embedding) > 0 and any(e != 0.0 for e in embedding[:10])
            }

            # Add to long-term memory
            self.memory_system.add_to_long_term_memory(
                content=results,
                memory_type="analysis_results",
                source="agent_coordinator",
                importance=0.8
            )

            # Add event to episodic memory
            self.memory_system.add_event(
                event_type="script_analysis_completed",
                content={
                    "script_name": script_name,
                    "script_id": script_id,
                    "analysis_time": results["analysis_time"]
                }
            )

            logger.info(f"Script analysis completed in {results['analysis_time']:.2f} seconds")
            return results

        except Exception as e:
            logger.error(f"Error in analyze_script: {e}")
            return {
                "script_name": script_name,
                "script_id": script_id,
                "analysis_time": time.time() - start_time,
                "timestamp": datetime.now().isoformat(),
                "error": str(e),
                "purpose": "Error analyzing script",
                "security_score": 5.0,
                "code_quality_score": 5.0,
                "risk_score": 5.0
            }

    async def _execute_security_analysis(self, script_content: str) -> Dict[str, Any]:
        """Execute security analysis using tool registry."""
        try:
            result = await tool_registry.execute_tool(
                tool_name="security_analysis",
                args={"script_content": script_content},
                use_cache=True,
                api_key=self.api_key
            )
            return result.get("result", {}) if result.get("success") else {"error": result.get("error")}
        except Exception as e:
            logger.error(f"Security analysis error: {e}")
            return {"error": str(e)}

    async def _execute_categorization(self, script_content: str) -> Dict[str, Any]:
        """Execute categorization using tool registry."""
        try:
            result = await tool_registry.execute_tool(
                tool_name="script_categorization",
                args={"script_content": script_content},
                use_cache=True,
                api_key=self.api_key
            )
            return result.get("result", {}) if result.get("success") else {"error": result.get("error")}
        except Exception as e:
            logger.error(f"Categorization error: {e}")
            return {"error": str(e)}

    async def _execute_documentation_search(self, script_content: str) -> Dict[str, Any]:
        """Execute documentation search using tool registry."""
        try:
            result = await tool_registry.execute_tool(
                tool_name="ms_docs_reference",
                args={"script_content": script_content},
                use_cache=True,
                api_key=self.api_key
            )
            return result.get("result", {}) if result.get("success") else {"error": result.get("error")}
        except Exception as e:
            logger.error(f"Documentation search error: {e}")
            return {"error": str(e)}
    
    async def categorize_script(
        self,
        script_content: str,
        script_name: Optional[str] = None,
        script_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Categorize a PowerShell script using the categorization agent.
        
        Args:
            script_content: Content of the script
            script_name: Name of the script
            script_id: ID of the script in the database
            
        Returns:
            Categorization results
        """
        # Use the tool registry to execute the categorization tool
        categorization_result = await tool_registry.execute_tool(
            tool_name="script_categorization",
            args={"script_content": script_content},
            use_cache=True,
            api_key=self.api_key
        )
        
        if categorization_result["success"]:
            # Add to working memory
            self.memory_system.add_to_working_memory(
                content=categorization_result["result"],
                memory_type="categorization",
                source="categorization_agent",
                importance=0.7
            )
            
            return categorization_result["result"]
        else:
            logger.error(f"Categorization failed: {categorization_result.get('error')}")
            return {"error": categorization_result.get("error", "Unknown error")}
    
    async def analyze_script_security(
        self,
        script_content: str,
        script_name: Optional[str] = None,
        script_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze the security of a PowerShell script using the security agent.
        
        Args:
            script_content: Content of the script
            script_name: Name of the script
            script_id: ID of the script in the database
            
        Returns:
            Security analysis results
        """
        # Use the tool registry to execute the security analysis tool
        security_result = await tool_registry.execute_tool(
            tool_name="security_analysis",
            args={"script_content": script_content},
            use_cache=True,
            api_key=self.api_key
        )
        
        if security_result["success"]:
            # Add to working memory
            self.memory_system.add_to_working_memory(
                content=security_result["result"],
                memory_type="security_analysis",
                source="security_agent",
                importance=0.8
            )
            
            return security_result["result"]
        else:
            logger.error(f"Security analysis failed: {security_result.get('error')}")
            return {"error": security_result.get("error", "Unknown error")}
    
    async def find_documentation_references(
        self,
        script_content: str,
        script_name: Optional[str] = None,
        script_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Find documentation references for a PowerShell script using the documentation agent.
        
        Args:
            script_content: Content of the script
            script_name: Name of the script
            script_id: ID of the script in the database
            
        Returns:
            Documentation references
        """
        # Use the tool registry to execute the documentation reference tool
        docs_result = await tool_registry.execute_tool(
            tool_name="ms_docs_reference",
            args={"script_content": script_content},
            use_cache=True,
            api_key=self.api_key
        )
        
        if docs_result["success"]:
            # Add to working memory
            self.memory_system.add_to_working_memory(
                content=docs_result["result"],
                memory_type="documentation_references",
                source="documentation_agent",
                importance=0.6
            )
            
            return docs_result["result"]
        else:
            logger.error(f"Documentation reference search failed: {docs_result.get('error')}")
            return {"error": docs_result.get("error", "Unknown error")}
    
    async def search_similar_scripts(
        self,
        script_content: str,
        limit: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Search for similar scripts using vector similarity.
        
        Args:
            script_content: Content of the script to find similar scripts for
            limit: Maximum number of similar scripts to return
            
        Returns:
            List of similar scripts with similarity scores
        """
        try:
            logger.info(f"Searching for similar scripts (limit={limit})")
            
            # Generate embedding for the input script
            await self.generate_script_embedding(script_content)
            
            # In a real implementation, this would:
            # 1. Query the vector database for similar embeddings
            # 2. Return matching scripts with similarity scores
            #
            # For now, we'll return an empty list as the vector DB integration
            # requires database connection setup
            
            logger.info("Vector similarity search completed (no results due to DB not configured)")
            return []
            
        except Exception as e:
            logger.error(f"Error searching for similar scripts: {e}")
            return []
    
    async def generate_script_embedding(
        self,
        script_content: str
    ) -> List[float]:
        """
        Generate a vector embedding for a script.
        
        Args:
            script_content: Content of the script
            
        Returns:
            Vector embedding (3072-dimensional for text-embedding-3-large)
        """
        try:
            # Use the script analyzer to generate embeddings
            logger.info("Generating script embedding using text-embedding-3-large")
            embedding = await self.script_analyzer.generate_embedding_async(script_content)
            
            logger.info(f"Generated embedding with {len(embedding)} dimensions")
            return embedding
        except Exception as e:
            logger.error(f"Error generating script embedding: {e}")
            # Return a zero vector on error
            return [0.0] * 3072
    
    def visualize_agent_network(
        self,
        filename: Optional[str] = None
    ) -> Optional[str]:
        """
        Visualize the agent network.
        
        Args:
            filename: Filename to save the visualization to
            
        Returns:
            Path to the saved visualization, or None if not saved
        """
        if not self.visualization_output_dir and not filename:
            logger.warning("No visualization output directory or filename specified")
            return None
        
        # Prepare agents and interactions for visualization
        agents = {}
        for agent_id, agent in self.multi_agent_system.agents.items():
            agents[agent_id] = {
                "name": agent.name,
                "type": agent.role.name,
                "importance": 0.8 if agent.role == AgentRole.COORDINATOR else 0.5
            }
        
        # Create interactions based on message history
        interactions = []
        for message in self.multi_agent_system.messages:
            interactions.append({
                "source": message.sender_id,
                "target": message.receiver_id,
                "type": message.message_type,
                "strength": 1.0
            })
        
        # Generate the visualization
        from .state_visualization import StateVisualizer
        visualizer = StateVisualizer(output_dir=self.visualization_output_dir)
        
        if filename:
            if self.visualization_output_dir:
                filepath = os.path.join(self.visualization_output_dir, filename)
            else:
                filepath = filename
        else:
            filepath = os.path.join(
                self.visualization_output_dir,
                f"agent_network_{int(time.time())}.png"
            )
        
        return visualizer.visualize_agent_network(
            agents=agents,
            interactions=interactions,
            filename=filepath,
            title="PSScript Agent Network"
        )
    
    def save_state(self, filepath: str) -> bool:
        """
        Save the state of the agent coordinator.
        
        Args:
            filepath: Path to save the state to
            
        Returns:
            True if the state was saved successfully, False otherwise
        """
        try:
            # Save the multi-agent system state
            mas_state_path = f"{filepath}.mas"
            self.multi_agent_system.save_state(mas_state_path)
            
            # Save the memory system state
            memory_state = self.memory_system.save_state()
            
            # Combine the states
            state = {
                "timestamp": datetime.now().isoformat(),
                "memory_state": memory_state
            }
            
            # Save to file
            with open(filepath, 'w') as f:
                json.dump(state, f, indent=2)
            
            logger.info(f"Saved agent coordinator state to {filepath}")
            return True
        except Exception as e:
            logger.error(f"Error saving agent coordinator state: {e}")
            return False
    
    def load_state(self, filepath: str) -> bool:
        """
        Load the state of the agent coordinator.
        
        Args:
            filepath: Path to load the state from
            
        Returns:
            True if the state was loaded successfully, False otherwise
        """
        try:
            # Load the multi-agent system state
            mas_state_path = f"{filepath}.mas"
            if os.path.exists(mas_state_path):
                self.multi_agent_system.load_state(mas_state_path)
            
            # Load the combined state
            with open(filepath, 'r') as f:
                state = json.load(f)
            
            # Load the memory system state
            if "memory_state" in state:
                self.memory_system.load_state(state["memory_state"])
            
            logger.info(f"Loaded agent coordinator state from {filepath}")
            return True
        except Exception as e:
            logger.error(f"Error loading agent coordinator state: {e}")
            return False
    
    async def process_chat(self, messages: List[Dict[str, str]]) -> str:
        """
        Process a chat conversation with the multi-agent system.
        
        Args:
            messages: List of message dictionaries with 'role' and 'content' keys
            
        Returns:
            Response from the agent system
        """
        logger.info(f"Processing chat with {len(messages)} messages")
        
        # Extract the user's message (the last message in the list)
        user_message = messages[-1]["content"] if messages and messages[-1]["role"] == "user" else ""
        
        if not user_message:
            return "I'm here to help with PowerShell scripting. What can I assist you with today?"
        
        # Start a new episode in the memory system
        self.memory_system.start_new_episode("Chat Conversation")
        
        # Add the conversation to working memory
        self.memory_system.add_to_working_memory(
            content=messages,
            memory_type="conversation",
            source="user",
            importance=0.7
        )
        
        # Create a task for processing the chat
        chat_task_id = self.multi_agent_system.create_task(
            name="Process Chat Message",
            description="Process a chat message and generate a response",
            required_capabilities=[
                AgentCapability.REASONING,
                AgentCapability.SCRIPT_ANALYSIS,
                AgentCapability.DOCUMENTATION
            ],
            priority=5,
            context={
                "messages": messages,
                "user_message": user_message
            }
        )
        
        # Wait for the task to complete
        task_completed = False
        start_time = time.time()
        timeout = 60  # 1 minute timeout
        
        while not task_completed and time.time() - start_time < timeout:
            # Check if the task is completed
            chat_task = self.multi_agent_system.tasks.get(chat_task_id)
            
            if chat_task and chat_task.status in [TaskStatus.COMPLETED, TaskStatus.FAILED]:
                task_completed = True
            else:
                # Wait a bit before checking again
                await asyncio.sleep(0.5)
        
        # Get the response
        if chat_task and chat_task.status == TaskStatus.COMPLETED and chat_task.result:
            response = chat_task.result.get("response", "")
        else:
            # Fallback response if the task failed or timed out
            response = """I'm having trouble processing your request at the moment. 
            
As a PowerShell expert assistant, I can help you with:
- PowerShell script analysis and optimization
- Security best practices for PowerShell
- PowerShell command syntax and usage
- Troubleshooting PowerShell scripts

Could you please try asking your question again or provide more details?"""
        
        # Add the response to working memory
        self.memory_system.add_to_working_memory(
            content={"role": "assistant", "content": response},
            memory_type="response",
            source="agent_coordinator",
            importance=0.7
        )
        
        # Add event to episodic memory
        self.memory_system.add_event(
            event_type="chat_response_generated",
            content={
                "processing_time": time.time() - start_time,
                "message_length": len(user_message),
                "response_length": len(response)
            }
        )
        
        return response
