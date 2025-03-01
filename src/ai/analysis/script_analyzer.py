"""
PowerShell Script Analyzer

Performs comprehensive analysis of PowerShell scripts using OpenAI's API.
"""

import os
import json
import time
from typing import Dict, List, Optional, Tuple, Any

import openai
import numpy as np
from tenacity import retry, stop_after_attempt, wait_exponential
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set OpenAI API key from environment
openai.api_key = os.getenv("OPENAI_API_KEY")

# Constants
EMBEDDING_MODEL = "text-embedding-ada-002"
ANALYSIS_MODEL = "gpt-4o"
EMBEDDING_DIMENSION = 1536  # Current OpenAI embedding dimension

class ScriptAnalyzer:
    """Analyzes PowerShell scripts for various properties using AI."""
    
    def __init__(self):
        if not openai.api_key:
            raise ValueError("OpenAI API key is not set. Set OPENAI_API_KEY environment variable.")
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
    def generate_embedding(self, text: str) -> List[float]:
        """Generate vector embedding for the given text."""
        response = openai.Embedding.create(
            model=EMBEDDING_MODEL,
            input=text
        )
        return response["data"][0]["embedding"]
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=20))
    def analyze_script(self, script_content: str) -> Dict[str, Any]:
        """Perform comprehensive analysis of a PowerShell script."""
        # Prepare the prompt for analysis
        system_prompt = """
        You are an expert PowerShell script analyzer. Your task is to analyze the provided PowerShell script and extract key information about it.
        You must provide a thorough, accurate, and security-focused analysis.
        """
        
        user_prompt = f"""
        Analyze the following PowerShell script and provide a detailed report with the following sections:
        
        1. PURPOSE: Summarize what this script is designed to do in 1-2 sentences
        2. SECURITY_ANALYSIS: Identify potential security vulnerabilities or risks (scale 1-10, with 10 being highest risk)
        3. CODE_QUALITY: Evaluate code quality and best practices (scale 1-10, with 10 being highest quality)
        4. PARAMETERS: Identify and document all parameters, including types and purposes
        5. CATEGORY: Classify this script into ONE of these categories: System Administration, Network Management, Active Directory, Security Tools, Backup & Recovery, Monitoring Scripts, Automation Workflows, Cloud Management, Virtualization, Development Tools, Database Management, Reporting Scripts, File Operations, User Management, Configuration Management, Deployment Scripts, Troubleshooting Tools, Data Processing, Integration Scripts, Documentation Generators
        6. OPTIMIZATION: Provide specific suggestions for improving the script
        7. RISK_ASSESSMENT: Evaluate the potential risk of executing this script (scale 1-10, with 10 being highest risk)
        
        Format your response as a JSON object with these keys: "purpose", "security_analysis", "security_score", "code_quality_score", "parameters", "category", "optimization", "risk_score"
        
        SCRIPT:
        ```powershell
        {script_content}
        ```
        """
        
        try:
            response = openai.ChatCompletion.create(
                model=ANALYSIS_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.2,
                response_format={"type": "json_object"}
            )
            
            # Parse the JSON response
            analysis_text = response.choices[0].message.content
            analysis = json.loads(analysis_text)
            
            # Ensure all expected keys are present
            required_keys = ["purpose", "security_analysis", "security_score", "code_quality_score", 
                            "parameters", "category", "optimization", "risk_score"]
            
            for key in required_keys:
                if key not in analysis:
                    analysis[key] = None
            
            return analysis
            
        except Exception as e:
            print(f"Error during script analysis: {e}")
            # Return a minimal response structure on error
            return {
                "purpose": "Error analyzing script",
                "security_analysis": "Analysis failed",
                "security_score": 5,
                "code_quality_score": 5,
                "parameters": {},
                "category": "Unknown",
                "optimization": ["Analysis failed"],
                "risk_score": 5
            }
    
    def find_similar_scripts(self, embedding: List[float], stored_embeddings: Dict[str, List[float]], limit: int = 5) -> List[Tuple[str, float]]:
        """Find similar scripts based on embedding similarity."""
        similarities = []
        
        for script_id, stored_embedding in stored_embeddings.items():
            # Calculate cosine similarity
            similarity = np.dot(embedding, stored_embedding) / (
                np.linalg.norm(embedding) * np.linalg.norm(stored_embedding)
            )
            similarities.append((script_id, float(similarity)))
        
        # Sort by similarity (highest first) and return top matches
        similarities.sort(key=lambda x: x[1], reverse=True)
        return similarities[:limit]
    
    def analyze_script_with_embedding(self, script_content: str) -> Dict[str, Any]:
        """Perform complete analysis including embedding generation."""
        # Generate embedding
        embedding = self.generate_embedding(script_content)
        
        # Perform analysis
        analysis = self.analyze_script(script_content)
        
        # Combine results
        result = {
            "analysis": analysis,
            "embedding": embedding
        }
        
        return result


# Example usage
if __name__ == "__main__":
    # Example PowerShell script
    example_script = """
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)]
        [string]$ComputerName,
        
        [Parameter(Mandatory=$false)]
        [switch]$IncludeServices = $false
    )
    
    Get-WmiObject -Class Win32_OperatingSystem -ComputerName $ComputerName | 
        Select-Object PSComputerName, Caption, Version, OSArchitecture
    
    if ($IncludeServices) {
        Get-Service -ComputerName $ComputerName | Where-Object {$_.Status -eq "Running"}
    }
    """
    
    analyzer = ScriptAnalyzer()
    result = analyzer.analyze_script_with_embedding(example_script)
    
    print(json.dumps(result["analysis"], indent=2))
    print(f"Embedding dimension: {len(result['embedding'])}")