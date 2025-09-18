
import requests
import base64
from datetime import datetime
from typing import Dict, List, Optional
from config import Config

class GitHubClient:
    """GitHub API client for repository operations"""
    
    def __init__(self, access_token: str):
        self.access_token = access_token
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
    
    def get_user_info(self) -> Dict:
        """Get authenticated user information"""
        response = requests.get(f"{self.base_url}/user", headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def list_repositories(self, per_page: int = 30) -> List[Dict]:
        """List user's repositories"""
        response = requests.get(
            f"{self.base_url}/user/repos",
            headers=self.headers,
            params={"per_page": per_page, "sort": "updated"}
        )
        response.raise_for_status()
        return response.json()
    
    def create_repository(self, name: str, description: str = "", private: bool = False) -> Dict:
        """Create a new repository"""
        data = {
            "name": name,
            "description": description,
            "private": private,
            "auto_init": True,
            "gitignore_template": "Python"
        }
        response = requests.post(
            f"{self.base_url}/user/repos",
            headers=self.headers,
            json=data
        )
        response.raise_for_status()
        return response.json()
    
    def get_file_content(self, owner: str, repo: str, path: str) -> Optional[Dict]:
        """Get file content from repository"""
        try:
            response = requests.get(
                f"{self.base_url}/repos/{owner}/{repo}/contents/{path}",
                headers=self.headers
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            return response.json()
        except requests.RequestException:
            return None
    
    def create_or_update_file(self, owner: str, repo: str, path: str, 
                             content: str, message: str, sha: str = None) -> Dict:
        """Create or update a file in repository"""
        encoded_content = base64.b64encode(content.encode('utf-8')).decode('utf-8')
        
        data = {
            "message": message,
            "content": encoded_content
        }
        
        if sha:
            data["sha"] = sha
        
        response = requests.put(
            f"{self.base_url}/repos/{owner}/{repo}/contents/{path}",
            headers=self.headers,
            json=data
        )
        response.raise_for_status()
        return response.json()
    
    def push_leetcode_solution(self, solution_data: Dict, repo_name: str = "leetcode-solutions") -> Dict:
        """Push LeetCode solution to repository"""
        try:
            # Get user info
            user_info = self.get_user_info()
            username = user_info["login"]
            
            # Check if repository exists
            try:
                repo_response = requests.get(
                    f"{self.base_url}/repos/{username}/{repo_name}",
                    headers=self.headers
                )
                if repo_response.status_code == 404:
                    # Create repository if it doesn't exist
                    self.create_repository(
                        name=repo_name,
                        description="My LeetCode solutions",
                        private=False
                    )
            except requests.RequestException:
                pass
            
            # Prepare file path and content
            problem_title = solution_data.get("title", "Unknown Problem")
            difficulty = solution_data.get("difficulty", "").lower()
            language = solution_data.get("language", "python").lower()
            
            # Create organized folder structure
            folder = f"{difficulty}/" if difficulty else ""
            timestamp = datetime.now().strftime("%Y%m%d")
            
            # Sanitize filename
            safe_title = "".join(c for c in problem_title if c.isalnum() or c in (' ', '-', '_')).rstrip()
            safe_title = safe_title.replace(' ', '_').lower()[:50]
            
            filename = f"{folder}{safe_title}_{timestamp}.{language}"
            
            # Add metadata comment to solution
            metadata_comment = self._generate_solution_header(solution_data)
            full_content = f"{metadata_comment}\n\n{solution_data['content']}"
            
            # Check if file already exists
            existing_file = self.get_file_content(username, repo_name, filename)
            sha = existing_file["sha"] if existing_file else None
            
            # Create commit message
            commit_message = f"Add solution: {problem_title}"
            if sha:
                commit_message = f"Update solution: {problem_title}"
            
            # Push file to repository
            result = self.create_or_update_file(
                owner=username,
                repo=repo_name,
                path=filename,
                content=full_content,
                message=commit_message,
                sha=sha
            )
            
            return {
                "success": True,
                "filename": filename,
                "url": result["content"]["html_url"],
                "message": f"Solution pushed successfully to {username}/{repo_name}"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    def _generate_solution_header(self, solution_data: Dict) -> str:
        """Generate metadata header for solution file"""
        title = solution_data.get("title", "Unknown Problem")
        difficulty = solution_data.get("difficulty", "Unknown")
        url = solution_data.get("url", "")
        date_solved = datetime.now().strftime("%Y-%m-%d")
        
        language = solution_data.get("language", "python")
        comment_char = "#" if language in ["python", "ruby"] else "//"
        
        header = f"""{comment_char} Problem: {title}
{comment_char} Difficulty: {difficulty}
{comment_char} Date: {date_solved}
{comment_char} URL: {url}
{comment_char}
{comment_char} Solution:"""
        
        return header
    
    def get_repository_stats(self, owner: str, repo: str) -> Dict:
        """Get repository statistics"""
        try:
            repo_response = requests.get(
                f"{self.base_url}/repos/{owner}/{repo}",
                headers=self.headers
            )
            repo_response.raise_for_status()
            repo_data = repo_response.json()
            
            # Get languages
            languages_response = requests.get(
                f"{self.base_url}/repos/{owner}/{repo}/languages",
                headers=self.headers
            )
            languages_response.raise_for_status()
            languages = languages_response.json()
            
            # Get recent commits
            commits_response = requests.get(
                f"{self.base_url}/repos/{owner}/{repo}/commits",
                headers=self.headers,
                params={"per_page": 10}
            )
            commits_response.raise_for_status()
            commits = commits_response.json()
            
            return {
                "name": repo_data["name"],
                "description": repo_data["description"],
                "stars": repo_data["stargazers_count"],
                "forks": repo_data["forks_count"],
                "languages": languages,
                "recent_commits": len(commits),
                "created_at": repo_data["created_at"],
                "updated_at": repo_data["updated_at"]
            }
            
        except Exception as e:
            return {"error": str(e)}