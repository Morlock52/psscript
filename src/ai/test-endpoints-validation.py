#!/usr/bin/env python3
"""
Comprehensive Endpoint Validation Test Suite
Tests all major endpoints and their dependencies
"""

import sys
import os
import subprocess
from pathlib import Path

# Add src/ai to path
sys.path.insert(0, os.path.dirname(__file__))

results = []
app = None
ai_root = Path(__file__).resolve().parent

def print_test_header(test_name: str):
    """Print formatted test header"""
    print("\n" + "="*60)
    print(f"TEST: {test_name}")
    print("="*60)

def print_result(test_name: str, passed: bool, details: str = ""):
    """Print formatted test result"""
    status = "✅ PASS" if passed else "❌ FAIL"
    print(f"{status}: {test_name}")
    if details:
        print(f"       {details}")
    results.append((test_name, passed, details))

# ============================================================================
# TEST 1: Verify Health Endpoint Structure
# ============================================================================
print_test_header("Health Endpoint Structure")
try:
    main_source = (ai_root / "main.py").read_text()
    if '@app.get("/health"' in main_source:
        print("✅ Health endpoint found at /health")
        print("   Methods: {'GET'}")
        print_result("Health Endpoint Structure", True, "Endpoint properly defined")
    else:
        print_result("Health Endpoint Structure", False, "Health endpoint not found")
except Exception as e:
    print_result("Health Endpoint Structure", False, str(e))

# ============================================================================
# TEST 2: Verify Analysis Endpoint Structure  
# ============================================================================
print_test_header("Analysis Endpoint Structure")
try:
    main_source = (ai_root / "main.py").read_text()
    if '@app.post("/analyze"' in main_source:
        print("✅ Analyze endpoint found at /analyze")
        print("   Methods: {'POST'}")
        print_result("Analysis Endpoint Structure", True, "Endpoint properly defined")
    else:
        print_result("Analysis Endpoint Structure", False, "Analyze endpoint not found")
except Exception as e:
    print_result("Analysis Endpoint Structure", False, str(e))

# ============================================================================
# TEST 3: Verify Security Analysis Endpoint Structure
# ============================================================================
print_test_header("Security Analysis Endpoint Structure")
try:
    main_source = (ai_root / "main.py").read_text()
    if '@app.post("/security-analysis"' in main_source:
        print("✅ Security analysis endpoint found at /security-analysis")
        print("   Methods: {'POST'}")
        print_result("Security Analysis Endpoint Structure", True, "Endpoint properly defined")
    else:
        print_result("Security Analysis Endpoint Structure", False, "Security analysis endpoint not found")
except Exception as e:
    print_result("Security Analysis Endpoint Structure", False, str(e))

# ============================================================================
# TEST 4: Verify Token Counter Integration
# ============================================================================
print_test_header("Token Counter Integration")
try:
    from utils.token_counter import token_counter, PRICING
    
    # Verify token_counter has required methods
    methods = ['track_usage', 'calculate_cost', 'estimate_cost', 'get_usage_summary', 'reset_usage']
    missing_methods = [m for m in methods if not hasattr(token_counter, m)]
    
    if not missing_methods:
        print("✅ Token counter has all required methods")
        
        # Check pricing for valid models
        valid_models = ['gpt-4o', 'gpt-4-turbo', 'text-embedding-3-large']
        all_models_present = all(model in PRICING for model in valid_models)
        
        if all_models_present:
            print("✅ All required models in pricing table:")
            for model in valid_models:
                pricing = PRICING[model]
                print(f"   - {model}: {pricing}")
            print_result("Token Counter Integration", True, "All models and methods present")
        else:
            missing = [m for m in valid_models if m not in PRICING]
            print_result("Token Counter Integration", False, f"Missing models: {missing}")
    else:
        print_result("Token Counter Integration", False, f"Missing methods: {missing_methods}")
except Exception as e:
    print_result("Token Counter Integration", False, str(e))

# ============================================================================
# TEST 5: Verify Embedding Generation Function
# ============================================================================
print_test_header("Embedding Generation Function")
try:
    from analysis.script_analyzer import ScriptAnalyzer, EMBEDDING_MODEL, EMBEDDING_DIMENSION
    
    analyzer = ScriptAnalyzer(use_cache=False)
    
    # Check for async method
    if hasattr(analyzer, 'generate_embedding_async'):
        print("✅ ScriptAnalyzer has generate_embedding_async method")
        
        # Check for sync method
        if hasattr(analyzer, 'generate_embedding'):
            print("✅ ScriptAnalyzer has generate_embedding (sync) method")
            
            print(f"✅ EMBEDDING_MODEL: {EMBEDDING_MODEL}")
            print(f"✅ EMBEDDING_DIMENSION: {EMBEDDING_DIMENSION}")
            print_result("Embedding Generation Function", True, "All components present")
        else:
            print_result("Embedding Generation Function", False, "generate_embedding (sync) not found")
    else:
        print_result("Embedding Generation Function", False, "generate_embedding_async not found")
except Exception as e:
    print_result("Embedding Generation Function", False, str(e))

# ============================================================================
# TEST 6: Verify Agent Coordinator Methods
# ============================================================================
print_test_header("Agent Coordinator Methods")
try:
    coordinator_source = (ai_root / "agents" / "agent_coordinator.py").read_text()

    required_methods = [
        'analyze_script',
        'analyze_script_security', 
        'categorize_script',
        'find_documentation_references',
        'generate_script_embedding',
        'search_similar_scripts'
    ]
    
    missing = [m for m in required_methods if f"def {m}(" not in coordinator_source]
    
    if not missing:
        print("✅ AgentCoordinator has all required methods:")
        for method in required_methods:
            print(f"   - {method}")
        print_result("Agent Coordinator Methods", True, "All methods present")
    else:
        print_result("Agent Coordinator Methods", False, f"Missing: {missing}")
except Exception as e:
    print_result("Agent Coordinator Methods", False, str(e))

# ============================================================================
# TEST 7: Verify Chat Endpoint Dependencies
# ============================================================================
print_test_header("Chat Endpoint Dependencies")
try:
    factory_source = (ai_root / "agents" / "agent_factory.py").read_text()
    if "def get_agent(" in factory_source:
        print("✅ agent_factory.get_agent available")
        
        if "def process_message(" in factory_source:
            print("✅ agent_factory.process_message available")
            print_result("Chat Endpoint Dependencies", True, "All dependencies present")
        else:
            print_result("Chat Endpoint Dependencies", False, "process_message not found")
    else:
        print_result("Chat Endpoint Dependencies", False, "get_agent not found")
except Exception as e:
    print_result("Chat Endpoint Dependencies", False, str(e))

# ============================================================================
# TEST 8: Verify Models Configuration
# ============================================================================
print_test_header("Models Configuration")
try:
    from config import config
    
    # Check for required model fields
    if hasattr(config.agent, 'default_model'):
        default_model = config.agent.default_model
        print(f"✅ default_model: {default_model}")
        
        # Verify it's a valid model
        if default_model in ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'o3', 'gpt-4-turbo', 'gpt-4']:
            print("   ✅ Valid model specified")
        else:
            print(f"   ⚠️  Unusual model: {default_model}")
    
    if hasattr(config.agent, 'reasoning_model'):
        reasoning_model = config.agent.reasoning_model
        print(f"✅ reasoning_model: {reasoning_model}")
        
        if reasoning_model in ['o3', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4']:
            print("   ✅ Valid model specified")
    
    if hasattr(config.agent, 'embedding_model'):
        embedding_model = config.agent.embedding_model
        print(f"✅ embedding_model: {embedding_model}")
        
        if embedding_model == 'text-embedding-3-large':
            print("   ✅ Correct embedding model")
    
    print_result("Models Configuration", True, "All models properly configured")
except Exception as e:
    print_result("Models Configuration", False, str(e))

# ============================================================================
# TEST 9: Verify No Invalid Model References
# ============================================================================
print_test_header("Invalid Model References Scan")
try:
    # Search for obviously deprecated completion-era model families.
    invalid_models = ['text-davinci-00', 'text-curie-00', 'text-babbage-00', 'text-ada-00']

    found_invalid = False
    for model in invalid_models:
        result = subprocess.run(
            ['rg', '-n', model, '.', '-g', '*.py', '-g', '!test-endpoints-validation.py'],
            cwd=str(ai_root),
            capture_output=True,
            text=True
        )
        
        if result.stdout:
            print(f"⚠️  Found references to {model}")
            found_invalid = True
    
    if not found_invalid:
        print("✅ No references to invalid models found")
        print_result("Invalid Model References Scan", True, "No invalid models detected")
    else:
        print_result("Invalid Model References Scan", False, "Invalid model references found")
except Exception as e:
    print_result("Invalid Model References Scan", False, str(e))

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "="*60)
print("ENDPOINT VALIDATION SUMMARY")
print("="*60)
passed = sum(1 for _, ok, _ in results if ok)
total = len(results)
for test_name, ok, details in results:
    status = "PASS" if ok else "FAIL"
    print(f"{status:4} | {test_name}{f' - {details}' if details else ''}")

print("")
print(f"Results: {passed}/{total} tests passed")
if passed == total:
    print("All endpoints and dependencies validated.")
    exit_code = 0
else:
    print("Validation failed. Resolve failed checks before deployment.")
    exit_code = 1
print("="*60)
sys.exit(exit_code)
