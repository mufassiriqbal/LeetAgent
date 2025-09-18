

import requests
from typing import Dict, List, Optional
from config import Config
import json
import re

class AIMLClient:
    """AI/ML client for LeetCode problem assistance using AIML API"""
    
    def __init__(self):
        self.api_key = Config.AIML_API_KEY
        self.base_url = "https://api.aimlapi.com/chat/completions"
        self.model = "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    def _make_api_request(self, messages: List[Dict], temperature: float = 0.3) -> Dict:
        """Make a request to the AIML API"""
        try:
            payload = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": 2048,
                "stream": False
            }
            
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            return response.json()
            
        except requests.exceptions.RequestException as e:
            raise Exception(f"AIML API request failed: {str(e)}")
        except json.JSONDecodeError as e:
            raise Exception(f"Invalid JSON response from AIML API: {str(e)}")
    
    def analyze_problem(self, problem_text: str, difficulty: str = "") -> Dict:
        """Analyze a LeetCode problem and provide insights"""
        try:
            prompt = f"""
            Analyze this LeetCode problem and provide a structured analysis:
            
            Problem: {problem_text}
            Difficulty: {difficulty}
            
            Please provide:
            1. Problem type/category
            2. Key algorithms or data structures needed
            3. Time and space complexity targets
            4. Similar problems
            5. Approach hints (without giving away the solution)
            
            Format your response as JSON.
            """
            
            messages = [
                {"role": "system", "content": "You are a helpful coding assistant specializing in algorithm analysis."},
                {"role": "user", "content": prompt}
            ]
            
            response = self._make_api_request(messages, temperature=0.3)
            content = response["choices"][0]["message"]["content"]
            
            # Try to parse as JSON, fallback to structured text
            try:
                return json.loads(content)
            except:
                return {"analysis": content, "format": "text"}
                
        except Exception as e:
            return {"error": f"AI analysis failed: {str(e)}"}
    
    def generate_solution_template(self, problem_text: str, language: str = "python") -> Dict:
        """Generate a solution template for the given problem"""
        try:
            prompt = f"""
            Create a solution template for this LeetCode problem in {language}:
            
            {problem_text}
            
            Provide:
            1. Function signature
            2. Basic structure with comments
            3. Test cases
            
            Do NOT provide the complete solution, just the template structure.
            """
            
            messages = [
                {"role": "system", "content": "You are a coding assistant. Provide templates, not complete solutions."},
                {"role": "user", "content": prompt}
            ]
            
            response = self._make_api_request(messages, temperature=0.2)
            template = response["choices"][0]["message"]["content"]
            
            return {
                "template": template,
                "language": language,
                "success": True
            }
            
        except Exception as e:
            return {"error": f"Template generation failed: {str(e)}", "success": False}
    
    def review_solution(self, problem_text: str, solution_code: str, language: str = "python") -> Dict:
        """Review and provide feedback on a solution"""
        try:
            prompt = f"""
            Review this LeetCode solution and provide constructive feedback:
            
            Problem: {problem_text}
            
            Solution ({language}):
            {solution_code}
            
            Please analyze:
            1. Correctness
            2. Time complexity
            3. Space complexity  
            4. Code quality and readability
            5. Potential optimizations
            6. Edge cases handling
            
            Provide specific, actionable feedback.
            """
            
            messages = [
                {"role": "system", "content": "You are an expert code reviewer specializing in algorithms and data structures."},
                {"role": "user", "content": prompt}
            ]
            
            response = self._make_api_request(messages, temperature=0.3)
            feedback = response["choices"][0]["message"]["content"]
            
            # Extract complexity information if mentioned
            time_complexity = self._extract_complexity(feedback, "time")
            space_complexity = self._extract_complexity(feedback, "space")
            
            return {
                "feedback": feedback,
                "time_complexity": time_complexity,
                "space_complexity": space_complexity,
                "success": True
            }
            
        except Exception as e:
            return {"error": f"Solution review failed: {str(e)}", "success": False}
    
    def suggest_optimizations(self, solution_code: str, language: str = "python") -> Dict:
        """Suggest optimizations for existing solution"""
        try:
            prompt = f"""
            Analyze this {language} solution and suggest specific optimizations:
            
            {solution_code}
            
            Focus on:
            1. Time complexity improvements
            2. Space complexity optimizations
            3. Code efficiency
            4. Better algorithms or data structures
            5. {language}-specific optimizations (if applicable)
            
            Provide concrete suggestions with explanations.
            """
            
            messages = [
                {"role": "system", "content": "You are an algorithm optimization expert."},
                {"role": "user", "content": prompt}
            ]
            
            response = self._make_api_request(messages, temperature=0.3)
            suggestions = response["choices"][0]["message"]["content"]
            
            return {
                "suggestions": suggestions,
                "success": True
            }
            
        except Exception as e:
            return {"error": f"Optimization suggestions failed: {str(e)}", "success": False}
    
    def explain_algorithm(self, algorithm_name: str, context: str = "") -> Dict:
        """Explain an algorithm in the context of LeetCode problems"""
        try:
            prompt = f"""
            Explain the {algorithm_name} algorithm in the context of LeetCode problems:
            {context}
            
            Include:
            1. How it works
            2. When to use it
            3. Time and space complexity
            4. Common LeetCode problem types where it's useful
            5. Implementation tips
            
            Keep it practical and focused on competitive programming.
            """
            
            messages = [
                {"role": "system", "content": "You are an algorithms tutor specializing in competitive programming."},
                {"role": "user", "content": prompt}
            ]
            
            response = self._make_api_request(messages, temperature=0.3)
            explanation = response["choices"][0]["message"]["content"]
            
            return {
                "explanation": explanation,
                "algorithm": algorithm_name,
                "success": True
            }
            
        except Exception as e:
            return {"error": f"Algorithm explanation failed: {str(e)}", "success": False}
    
    def generate_test_cases(self, problem_text: str, solution_code: str) -> Dict:
        """Generate additional test cases for a problem"""
        try:
            prompt = f"""
            Generate comprehensive test cases for this problem:
            
            Problem: {problem_text}
            Solution: {solution_code}
            
            Include:
            1. Edge cases
            2. Boundary conditions
            3. Large input cases
            4. Corner cases specific to this problem
            
            Format as: input -> expected_output
            """
            
            messages = [
                {"role": "system", "content": "You are a test case generation expert."},
                {"role": "user", "content": prompt}
            ]
            
            response = self._make_api_request(messages, temperature=0.4)
            test_cases = response["choices"][0]["message"]["content"]
            
            return {
                "test_cases": test_cases,
                "success": True
            }
            
        except Exception as e:
            return {"error": f"Test case generation failed: {str(e)}", "success": False}
    
    def _extract_complexity(self, text: str, complexity_type: str) -> Optional[str]:
        """Extract time or space complexity from text"""
        pattern = f"{complexity_type}.*?complexity.*?O\\([^)]+\\)"
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            complexity_match = re.search(r"O\([^)]+\)", match.group())
            return complexity_match.group() if complexity_match else None
        return None
    
    def get_problem_difficulty_estimate(self, problem_text: str) -> Dict:
        """Estimate problem difficulty based on content"""
        try:
            prompt = f"""
            Estimate the difficulty of this LeetCode problem and explain why:
            
            {problem_text}
            
            Rate as: Easy, Medium, or Hard
            Provide reasoning based on:
            1. Algorithm complexity required
            2. Implementation difficulty
            3. Problem-solving skills needed
            4. Typical acceptance rate expectations
            """
            
            messages = [
                {"role": "system", "content": "You are a LeetCode difficulty assessment expert."},
                {"role": "user", "content": prompt}
            ]
            
            response = self._make_api_request(messages, temperature=0.2)
            assessment = response["choices"][0]["message"]["content"]
            
            # Extract difficulty rating
            difficulty = "Unknown"
            for level in ["Easy", "Medium", "Hard"]:
                if level.lower() in assessment.lower():
                    difficulty = level
                    break
            
            return {
                "estimated_difficulty": difficulty,
                "assessment": assessment,
                "success": True
            }
            
        except Exception as e:
            return {"error": f"Difficulty estimation failed: {str(e)}", "success": False}