#!/usr/bin/env python3
"""
Quick run script for LeetCode Agent
"""

import subprocess
import sys
import os

def check_requirements():
    """Check if requirements are installed"""
    try:
        import flask
        import requests
        print("✅ Dependencies are installed")
        return True
    except ImportError:
        print("❌ Dependencies not installed. Run: pip install -r requirements.txt")
        return False

def check_env_file():
    """Check if .env file exists"""
    if os.path.exists('.env'):
        print("✅ .env file found")
        return True
    else:
        print("❌ .env file not found. Copy .env.example to .env and configure it")
        return False

def run_server():
    """Run the Flask server"""
    if check_requirements() and check_env_file():
        print("🚀 Starting LeetCode Agent server...")
        subprocess.run([sys.executable, "server.py"])
    else:
        print("⚠️  Please fix the issues above before running")

if __name__ == "__main__":
    run_server()
