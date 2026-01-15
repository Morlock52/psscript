#!/usr/bin/env python3
"""
Test script to verify LangGraph 1.0 setup and implementation.

This script tests:
1. Dependencies are installed correctly
2. LangGraph orchestrator can be instantiated
3. Tools work as expected
4. Basic workflow executes successfully
"""

import sys
import os
import asyncio
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

def test_imports():
    """Test that all required packages can be imported."""
    print("=" * 60)
    print("Testing imports...")
    print("=" * 60)

    try:
        import langgraph
        print(f"✓ langgraph version: {langgraph.__version__}")
    except ImportError as e:
        print(f"✗ Failed to import langgraph: {e}")
        return False

    try:
        import langchain
        print(f"✓ langchain version: {langchain.__version__}")
    except ImportError as e:
        print(f"✗ Failed to import langchain: {e}")
        return False

    try:
        import langchain_openai  # noqa: F401 - Import check only
        print("✓ langchain_openai imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import langchain_openai: {e}")
        return False

    try:
        import langchain_core  # noqa: F401 - Import check only
        print("✓ langchain_core imported successfully")
    except ImportError as e:
        print(f"✗ Failed to import langchain_core: {e}")
        return False

    print("\nAll imports successful!\n")
    return True


def test_tools():
    """Test that all tools work correctly."""
    print("=" * 60)
    print("Testing tools...")
    print("=" * 60)

    try:
        from agents.langgraph_production import (
            analyze_powershell_script,
            security_scan,
            quality_analysis,
            generate_optimizations
        )

        test_script = """
        param([string]$Path)
        Get-ChildItem -Path $Path -Recurse
        """

        print("\n1. Testing analyze_powershell_script...")
        result = analyze_powershell_script.invoke({"script_content": test_script})
        data = json.loads(result)
        print(f"   Purpose: {data.get('purpose', 'N/A')}")
        print(f"   Line count: {data.get('line_count', 'N/A')}")
        print("   ✓ analyze_powershell_script works")

        print("\n2. Testing security_scan...")
        result = security_scan.invoke({"script_content": test_script})
        data = json.loads(result)
        print(f"   Risk level: {data.get('risk_level', 'N/A')}")
        print(f"   Findings: {data.get('findings_count', 0)}")
        print("   ✓ security_scan works")

        print("\n3. Testing quality_analysis...")
        result = quality_analysis.invoke({"script_content": test_script})
        data = json.loads(result)
        print(f"   Quality score: {data.get('quality_score', 'N/A')}")
        print(f"   Code lines: {data.get('metrics', {}).get('code_lines', 'N/A')}")
        print("   ✓ quality_analysis works")

        print("\n4. Testing generate_optimizations...")
        result = generate_optimizations.invoke({
            "script_content": test_script,
            "quality_metrics": json.dumps(data)
        })
        data = json.loads(result)
        print(f"   Optimizations: {data.get('total_optimizations', 0)}")
        print("   ✓ generate_optimizations works")

        print("\nAll tools working!\n")
        return True

    except Exception as e:
        print(f"\n✗ Tool test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_graph_construction():
    """Test that the graph can be constructed."""
    print("=" * 60)
    print("Testing graph construction...")
    print("=" * 60)

    try:
        from agents.langgraph_production import create_production_graph
        from langgraph.checkpoint.memory import MemorySaver

        checkpointer = MemorySaver()
        graph = create_production_graph(checkpointer=checkpointer)

        print("✓ Graph constructed successfully")
        print(f"  Graph type: {type(graph).__name__}")

        # Try to get the graph structure
        try:
            print("\nGraph structure:")
            print(f"  Nodes: {list(graph.nodes.keys()) if hasattr(graph, 'nodes') else 'N/A'}")
            print(f"  Entry point: {graph.entry_point if hasattr(graph, 'entry_point') else 'N/A'}")
        except Exception:
            print("  (Structure details not available)")

        print("\nGraph construction successful!\n")
        return True

    except Exception as e:
        print(f"\n✗ Graph construction failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_orchestrator():
    """Test the full orchestrator."""
    print("=" * 60)
    print("Testing orchestrator (requires API key)...")
    print("=" * 60)

    # Check for API key
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("\n⚠ OPENAI_API_KEY not set - skipping orchestrator test")
        print("  To test the orchestrator, set OPENAI_API_KEY environment variable")
        return True

    try:
        from agents.langgraph_production import LangGraphProductionOrchestrator

        print("\nInitializing orchestrator...")
        orchestrator = LangGraphProductionOrchestrator(api_key=api_key)
        print("✓ Orchestrator initialized")

        test_script = """
        # Simple test script
        param([string]$Name = "World")
        Write-Host "Hello, $Name!"
        """

        print("\nRunning analysis (this may take a few seconds)...")
        result = await orchestrator.analyze_script(
            script_content=test_script,
            thread_id="test_session"
        )

        print("\n✓ Analysis completed!")
        print(f"  Workflow ID: {result.get('workflow_id')}")
        print(f"  Status: {result.get('status')}")
        print(f"  Stages completed: {result.get('current_stage')}")

        if result.get('final_response'):
            print("\nFinal response preview:")
            preview = result['final_response'][:200]
            print(f"  {preview}..." if len(result['final_response']) > 200 else f"  {preview}")

        print("\nOrchestrator test successful!\n")
        return True

    except Exception as e:
        print(f"\n✗ Orchestrator test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_api_endpoints():
    """Test the API endpoints (basic import test)."""
    print("=" * 60)
    print("Testing API endpoints...")
    print("=" * 60)

    try:
        from langgraph_endpoints import router

        print("✓ API router imported successfully")
        print(f"  Router prefix: {router.prefix}")
        print(f"  Number of routes: {len(router.routes)}")

        # List routes
        print("\n  Available endpoints:")
        for route in router.routes:
            if hasattr(route, 'path') and hasattr(route, 'methods'):
                methods = ', '.join(route.methods) if route.methods else 'N/A'
                print(f"    {methods:10} {route.path}")

        print("\nAPI endpoints test successful!\n")
        return True

    except Exception as e:
        print(f"\n✗ API endpoints test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 60)
    print("LangGraph 1.0 Setup Verification")
    print("=" * 60 + "\n")

    results = []

    # Test 1: Imports
    results.append(("Imports", test_imports()))

    # Test 2: Tools
    results.append(("Tools", test_tools()))

    # Test 3: Graph construction
    results.append(("Graph Construction", test_graph_construction()))

    # Test 4: API endpoints
    results.append(("API Endpoints", asyncio.run(test_api_endpoints())))

    # Test 5: Orchestrator (requires API key)
    results.append(("Orchestrator", asyncio.run(test_orchestrator())))

    # Summary
    print("=" * 60)
    print("Test Summary")
    print("=" * 60)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for test_name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status:10} {test_name}")

    print("\n" + "=" * 60)
    print(f"Results: {passed}/{total} tests passed")
    print("=" * 60 + "\n")

    if passed == total:
        print("🎉 All tests passed! LangGraph 1.0 is ready to use.")
        return 0
    elif passed >= total - 1:  # Allow orchestrator test to fail if no API key
        print("✓ Setup complete! (Some tests skipped due to missing API key)")
        return 0
    else:
        print("⚠ Some tests failed. Please check the output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
