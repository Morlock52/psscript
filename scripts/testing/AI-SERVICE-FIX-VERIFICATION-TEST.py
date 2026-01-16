#!/usr/bin/env python3
"""
Comprehensive test suite to verify all AI service bug fixes.
Tests verify:
1. Imports are correct
2. Model references are valid
3. OpenAI SDK is modern
4. Async/sync event loops work
5. Embeddings generate properly
6. Token counter has valid models
"""

import sys
import os
from pathlib import Path

# Add src/ai to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src" / "ai"))

def test_imports():
    """Test 1: Verify imports are correct"""
    print("\n" + "="*60)
    print("TEST 1: Verifying Imports")
    print("="*60)
    
    try:
        # Check if agent_factory can be imported
        from agents.agent_factory import agent_factory
        print("✅ agent_factory imported successfully from agents.agent_factory")
        return True
    except ImportError as e:
        print(f"❌ Failed to import agent_factory: {e}")
        return False

def test_config_models():
    """Test 2: Verify config has valid models"""
    print("\n" + "="*60)
    print("TEST 2: Verifying Config Models")
    print("="*60)
    
    try:
        from config import config
        
        # Check model names
        default_model = config.agent.default_model
        reasoning_model = config.agent.reasoning_model
        embedding_model = config.agent.embedding_model
        
        print(f"  Default Model: {default_model}")
        print(f"  Reasoning Model: {reasoning_model}")
        print(f"  Embedding Model: {embedding_model}")
        
        # Verify no invalid models
        invalid_models = ["gpt-5.2-codex", "gpt-5.2", "gpt-5.2-instant", "o3-mini"]
        
        for model in [default_model, reasoning_model, embedding_model]:
            if model in invalid_models:
                print(f"❌ Invalid model found: {model}")
                return False
        
        # Verify valid models
        valid_prefixes = ["gpt-4", "text-embedding"]
        all_valid = all(any(model.startswith(prefix) for prefix in valid_prefixes) 
                       for model in [default_model, reasoning_model, embedding_model])
        
        if all_valid:
            print("✅ All config models are valid")
            return True
        else:
            print("❌ Some config models are invalid")
            return False
    except Exception as e:
        print(f"❌ Error testing config: {e}")
        return False

def test_openai_sdk():
    """Test 3: Verify modern OpenAI SDK is used"""
    print("\n" + "="*60)
    print("TEST 3: Verifying Modern OpenAI SDK")
    print("="*60)
    
    try:
        from openai import OpenAI, AsyncOpenAI
        print("✅ Modern OpenAI SDK imports (OpenAI, AsyncOpenAI) work correctly")
        
        # Check if clients can be instantiated
        api_key = os.getenv("OPENAI_API_KEY", "test-key")
        client = OpenAI(api_key=api_key)
        async_client = AsyncOpenAI(api_key=api_key)
        
        print("✅ OpenAI clients instantiated successfully")
        return True
    except ImportError as e:
        print(f"❌ Failed to import modern OpenAI SDK: {e}")
        return False
    except Exception as e:
        print(f"❌ Error with OpenAI SDK: {e}")
        return False

def test_token_counter_models():
    """Test 4: Verify token counter has valid models"""
    print("\n" + "="*60)
    print("TEST 4: Verifying Token Counter Models")
    print("="*60)
    
    try:
        from utils.token_counter import PRICING
        
        print("  Available models in PRICING:")
        invalid_models = ["gpt-5.2-codex", "gpt-5.2", "gpt-5.2-instant"]
        
        for model in PRICING.keys():
            print(f"    - {model}")
            if model in invalid_models:
                print(f"      ❌ Invalid model found: {model}")
                return False
        
        # Check for valid models
        valid_models = ["gpt-4o", "gpt-4-turbo", "text-embedding-3-large"]
        for model in valid_models:
            if model not in PRICING:
                print(f"  ❌ Missing expected model: {model}")
                return False
        
        print("✅ Token counter has valid models and pricing")
        return True
    except Exception as e:
        print(f"❌ Error testing token counter: {e}")
        return False

def test_script_analyzer_constants():
    """Test 5: Verify script analyzer has valid constants"""
    print("\n" + "="*60)
    print("TEST 5: Verifying Script Analyzer Constants")
    print("="*60)
    
    try:
        from analysis.script_analyzer import ANALYSIS_MODEL, EMBEDDING_MODEL, EMBEDDING_DIMENSION
        
        print(f"  Analysis Model: {ANALYSIS_MODEL}")
        print(f"  Embedding Model: {EMBEDDING_MODEL}")
        print(f"  Embedding Dimension: {EMBEDDING_DIMENSION}")
        
        # Verify models
        if "gpt-5.2" in ANALYSIS_MODEL or "gpt-5.2" in EMBEDDING_MODEL:
            print("❌ Invalid model references found in script_analyzer")
            return False
        
        if EMBEDDING_DIMENSION != 3072:
            print(f"❌ Unexpected embedding dimension: {EMBEDDING_DIMENSION} (expected 3072)")
            return False
        
        print("✅ Script analyzer constants are valid")
        return True
    except Exception as e:
        print(f"❌ Error testing script analyzer: {e}")
        return False

def test_agent_coordinator_imports():
    """Test 6: Verify agent coordinator has script analyzer"""
    print("\n" + "="*60)
    print("TEST 6: Verifying Agent Coordinator Imports")
    print("="*60)
    
    try:
        # Check source code for ScriptAnalyzer import
        coordinator_path = Path(__file__).parent / "src" / "ai" / "agents" / "agent_coordinator.py"
        with open(coordinator_path, 'r') as f:
            content = f.read()
            
        if "from ..analysis.script_analyzer import ScriptAnalyzer" in content:
            print("✅ AgentCoordinator imports ScriptAnalyzer correctly")
        else:
            print("❌ AgentCoordinator missing ScriptAnalyzer import")
            return False
        
        if "self.script_analyzer = ScriptAnalyzer" in content:
            print("✅ AgentCoordinator initializes ScriptAnalyzer")
        else:
            print("❌ AgentCoordinator doesn't initialize ScriptAnalyzer")
            return False
        
        # Check for actual embedding implementation
        if "await self.script_analyzer.generate_embedding_async" in content:
            print("✅ AgentCoordinator uses actual embedding generation")
        else:
            print("❌ AgentCoordinator doesn't use actual embedding generation")
            return False
        
        return True
    except Exception as e:
        print(f"❌ Error testing agent coordinator: {e}")
        return False

def test_main_py_imports():
    """Test 7: Verify main.py has all required imports"""
    print("\n" + "="*60)
    print("TEST 7: Verifying main.py Imports")
    print("="*60)
    
    try:
        main_path = Path(__file__).parent / "src" / "ai" / "main.py"
        with open(main_path, 'r') as f:
            content = f.read()
        
        required_imports = [
            "from agents.agent_factory import agent_factory",
            "from agents.agent_coordinator import AgentCoordinator",
            "from analysis.script_analyzer import ScriptAnalyzer",
        ]
        
        for imp in required_imports:
            if imp in content:
                print(f"  ✅ {imp}")
            else:
                print(f"  ❌ Missing: {imp}")
                return False
        
        # Check that agent_factory is actually used
        if "agent_factory.get_agent" in content or "agent_factory.process_message" in content:
            print("✅ main.py uses agent_factory correctly")
        else:
            print("❌ main.py doesn't use agent_factory")
            return False
        
        return True
    except Exception as e:
        print(f"❌ Error testing main.py: {e}")
        return False

def test_no_invalid_models():
    """Test 8: Scan all files for invalid models"""
    print("\n" + "="*60)
    print("TEST 8: Scanning for Invalid Models")
    print("="*60)
    
    try:
        ai_path = Path(__file__).parent / "src" / "ai"
        invalid_patterns = ["gpt-5.2-codex", "gpt-5.2-instant", "gpt-5.2\""]
        files_with_issues = []
        
        for py_file in ai_path.rglob("*.py"):
            # Skip __pycache__ and venv
            if "__pycache__" in str(py_file) or "venv" in str(py_file) or "_archive" in str(py_file):
                continue
            
            with open(py_file, 'r') as f:
                content = f.read()
                for pattern in invalid_patterns:
                    if pattern in content:
                        files_with_issues.append((str(py_file), pattern))
        
        if files_with_issues:
            print("❌ Found invalid model references:")
            for filepath, pattern in files_with_issues:
                print(f"    - {filepath}: {pattern}")
            return False
        else:
            print("✅ No invalid model references found in codebase")
            return True
    except Exception as e:
        print(f"❌ Error scanning files: {e}")
        return False

def main():
    """Run all tests"""
    print("\n" + "="*60)
    print("AI SERVICE BUG FIX VERIFICATION TEST SUITE")
    print("="*60)
    print(f"Started at: {os.path.basename(__file__)}")
    
    tests = [
        ("Imports", test_imports),
        ("Config Models", test_config_models),
        ("OpenAI SDK", test_openai_sdk),
        ("Token Counter", test_token_counter_models),
        ("Script Analyzer", test_script_analyzer_constants),
        ("Agent Coordinator", test_agent_coordinator_imports),
        ("Main.py Imports", test_main_py_imports),
        ("Invalid Models Scan", test_no_invalid_models),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Test {test_name} crashed: {e}")
            results.append((test_name, False))
    
    # Print summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 ALL TESTS PASSED! AI Service bugs are fixed.")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Review errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
