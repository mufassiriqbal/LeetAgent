"""
scheduler.py - LeetCode Agent
TODO: Add content from Claude artifacts
"""

import schedule
import time
import threading
from datetime import datetime, timedelta
from typing import Dict, List, Callable, Optional
import logging
import json
import os
from email_client import EmailClient
from github_client import GitHubClient

class LeetCodeScheduler:
    """Scheduler for automated LeetCode tasks and notifications"""
    
    def __init__(self):
        self.email_client = EmailClient()
        self.running = False
        self.scheduler_thread = None
        self.user_preferences = {}
        self.daily_stats = {}
        
        # Setup logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Load user preferences
        self.load_preferences()
    
    def start(self):
        """Start the scheduler in a separate thread"""
        if self.running:
            self.logger.warning("Scheduler is already running")
            return
        
        self.running = True
        self.scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self.scheduler_thread.start()
        self.logger.info("Scheduler started")
    
    def stop(self):
        """Stop the scheduler"""
        self.running = False
        if self.scheduler_thread:
            self.scheduler_thread.join(timeout=5)
        self.logger.info("Scheduler stopped")
    
    def _run_scheduler(self):
        """Main scheduler loop"""
        while self.running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
            except Exception as e:
                self.logger.error(f"Scheduler error: {str(e)}")
                time.sleep(60)
    
    def schedule_daily_summary(self, user_email: str, send_time: str = "18:00"):
        """Schedule daily summary emails"""
        def send_summary():
            try:
                summary_data = self.generate_daily_summary(user_email)
                result = self.email_client.send_daily_summary(user_email, summary_data)
                if result["success"]:
                    self.logger.info(f"Daily summary sent to {user_email}")
                else:
                    self.logger.error(f"Failed to send daily summary: {result['error']}")
            except Exception as e:
                self.logger.error(f"Error sending daily summary: {str(e)}")
        
        schedule.every().day.at(send_time).do(send_summary)
        self.logger.info(f"Scheduled daily summary for {user_email} at {send_time}")
    
    def schedule_weekly_report(self, user_email: str, day: str = "sunday", send_time: str = "19:00"):
        """Schedule weekly progress reports"""
        def send_weekly_report():
            try:
                report_data = self.generate_weekly_report(user_email)
                result = self.email_client.send_weekly_report(user_email, report_data)
                if result["success"]:
                    self.logger.info(f"Weekly report sent to {user_email}")
                else:
                    self.logger.error(f"Failed to send weekly report: {result['error']}")
            except Exception as e:
                self.logger.error(f"Error sending weekly report: {str(e)}")
        
        getattr(schedule.every(), day.lower()).at(send_time).do(send_weekly_report)
        self.logger.info(f"Scheduled weekly report for {user_email} on {day} at {send_time}")
    
    def schedule_problem_reminder(self, user_email: str, frequency: str = "daily", send_time: str = "09:00"):
        """Schedule problem-solving reminders"""
        def send_reminder():
            try:
                reminder_data = self.generate_problem_reminder(user_email)
                result = self.email_client.send_problem_reminder(user_email, reminder_data)
                if result["success"]:
                    self.logger.info(f"Problem reminder sent to {user_email}")
                else:
                    self.logger.error(f"Failed to send problem reminder: {result['error']}")
            except Exception as e:
                self.logger.error(f"Error sending problem reminder: {str(e)}")
        
        if frequency.lower() == "daily":
            schedule.every().day.at(send_time).do(send_reminder)
        elif frequency.lower() == "weekly":
            schedule.every().monday.at(send_time).do(send_reminder)
        elif frequency.lower() == "weekdays":
            for day in ["monday", "tuesday", "wednesday", "thursday", "friday"]:
                getattr(schedule.every(), day).at(send_time).do(send_reminder)
        
        self.logger.info(f"Scheduled {frequency} problem reminder for {user_email} at {send_time}")
    
    def schedule_github_backup(self, github_token: str, backup_time: str = "02:00"):
        """Schedule daily GitHub repository backup"""
        def backup_repos():
            try:
                github_client = GitHubClient(github_token)
                result = self.backup_repositories(github_client)
                if result["success"]:
                    self.logger.info("GitHub repositories backed up successfully")
                else:
                    self.logger.error(f"GitHub backup failed: {result['error']}")
            except Exception as e:
                self.logger.error(f"Error during GitHub backup: {str(e)}")
        
        schedule.every().day.at(backup_time).do(backup_repos)
        self.logger.info(f"Scheduled daily GitHub backup at {backup_time}")
    
    def record_solution_push(self, user_email: str, solution_data: Dict):
        """Record a solution push for statistics"""
        today = datetime.now().strftime('%Y-%m-%d')
        
        if user_email not in self.daily_stats:
            self.daily_stats[user_email] = {}
        
        if today not in self.daily_stats[user_email]:
            self.daily_stats[user_email][today] = {
                "problems_solved": 0,
                "total_pushes": 0,
                "languages_used": set(),
                "difficulties": {"Easy": 0, "Medium": 0, "Hard": 0},
                "solutions": []
            }
        
        daily_data = self.daily_stats[user_email][today]
        daily_data["problems_solved"] += 1
        daily_data["total_pushes"] += 1
        daily_data["languages_used"].add(solution_data.get("language", "unknown"))
        
        difficulty = solution_data.get("difficulty", "Unknown")
        if difficulty in daily_data["difficulties"]:
            daily_data["difficulties"][difficulty] += 1
        
        daily_data["solutions"].append({
            "title": solution_data.get("title", "Unknown"),
            "difficulty": difficulty,
            "language": solution_data.get("language", "unknown"),
            "timestamp": datetime.now().isoformat(),
            "url": solution_data.get("url", "")
        })
        
        # Save statistics
        self.save_statistics()
    
    def generate_daily_summary(self, user_email: str) -> Dict:
        """Generate daily summary data"""
        today = datetime.now().strftime('%Y-%m-%d')
        
        if user_email not in self.daily_stats or today not in self.daily_stats[user_email]:
            return {
                "problems_solved": 0,
                "total_pushes": 0,
                "languages_used": [],
                "difficulties": {"Easy": 0, "Medium": 0, "Hard": 0},
                "solutions": []
            }
        
        daily_data = self.daily_stats[user_email][today].copy()
        daily_data["languages_used"] = list(daily_data["languages_used"])
        return daily_data
    
    def generate_weekly_report(self, user_email: str) -> Dict:
        """Generate weekly progress report"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=7)
        
        weekly_stats = {
            "start_date": start_date.strftime('%Y-%m-%d'),
            "end_date": end_date.strftime('%Y-%m-%d'),
            "total_problems": 0,
            "total_pushes": 0,
            "languages_used": set(),
            "difficulties": {"Easy": 0, "Medium": 0, "Hard": 0},
            "daily_breakdown": {},
            "solutions": []
        }
        
        if user_email in self.daily_stats:
            for date_str, daily_data in self.daily_stats[user_email].items():
                date_obj = datetime.strptime(date_str, '%Y-%m-%d')
                if start_date <= date_obj <= end_date:
                    weekly_stats["total_problems"] += daily_data["problems_solved"]
                    weekly_stats["total_pushes"] += daily_data["total_pushes"]
                    weekly_stats["languages_used"].update(daily_data["languages_used"])
                    
                    for difficulty, count in daily_data["difficulties"].items():
                        weekly_stats["difficulties"][difficulty] += count
                    
                    weekly_stats["daily_breakdown"][date_str] = daily_data["problems_solved"]
                    weekly_stats["solutions"].extend(daily_data["solutions"])
        
        weekly_stats["languages_used"] = list(weekly_stats["languages_used"])
        return weekly_stats
    
    def generate_problem_reminder(self, user_email: str) -> Dict:
        """Generate problem reminder data"""
        today = datetime.now().strftime('%Y-%m-%d')
        
        # Check if user solved any problems today
        solved_today = 0
        if (user_email in self.daily_stats and 
            today in self.daily_stats[user_email]):
            solved_today = self.daily_stats[user_email][today]["problems_solved"]
        
        # Get user preferences
        user_prefs = self.user_preferences.get(user_email, {})
        target_problems = user_prefs.get("daily_target", 1)
        preferred_difficulty = user_prefs.get("preferred_difficulty", "Medium")
        
        return {
            "solved_today": solved_today,
            "target_problems": target_problems,
            "remaining_problems": max(0, target_problems - solved_today),
            "preferred_difficulty": preferred_difficulty,
            "motivational_message": self._get_motivational_message(solved_today, target_problems)
        }
    
    def backup_repositories(self, github_client: GitHubClient) -> Dict:
        """Backup GitHub repositories"""
        try:
            user_info = github_client.get_user_info()
            repos = github_client.list_repositories(per_page=100)
            
            backup_data = {
                "timestamp": datetime.now().isoformat(),
                "user": user_info["login"],
                "total_repos": len(repos),
                "repositories": []
            }
            
            for repo in repos:
                repo_data = {
                    "name": repo["name"],
                    "description": repo["description"],
                    "private": repo["private"],
                    "stars": repo["stargazers_count"],
                    "forks": repo["forks_count"],
                    "language": repo["language"],
                    "created_at": repo["created_at"],
                    "updated_at": repo["updated_at"],
                    "clone_url": repo["clone_url"]
                }
                backup_data["repositories"].append(repo_data)
            
            # Save backup data
            backup_filename = f"github_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            with open(f"backups/{backup_filename}", "w") as f:
                json.dump(backup_data, f, indent=2)
            
            return {"success": True, "backup_file": backup_filename, "repos_backed_up": len(repos)}
            
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def set_user_preferences(self, user_email: str, preferences: Dict):
        """Set user preferences"""
        self.user_preferences[user_email] = preferences
        self.save_preferences()
    
    def load_preferences(self):
        """Load user preferences from file"""
        try:
            if os.path.exists("data/user_preferences.json"):
                with open("data/user_preferences.json", "r") as f:
                    self.user_preferences = json.load(f)
        except Exception as e:
            self.logger.error(f"Failed to load preferences: {str(e)}")
            self.user_preferences = {}
    
    def save_preferences(self):
        """Save user preferences to file"""
        try:
            os.makedirs("data", exist_ok=True)
            with open("data/user_preferences.json", "w") as f:
                json.dump(self.user_preferences, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save preferences: {str(e)}")
    
    def load_statistics(self):
        """Load statistics from file"""
        try:
            if os.path.exists("data/daily_stats.json"):
                with open("data/daily_stats.json", "r") as f:
                    loaded_stats = json.load(f)
                    # Convert sets back from lists
                    for user_email, user_data in loaded_stats.items():
                        for date, daily_data in user_data.items():
                            if "languages_used" in daily_data:
                                daily_data["languages_used"] = set(daily_data["languages_used"])
                    self.daily_stats = loaded_stats
        except Exception as e:
            self.logger.error(f"Failed to load statistics: {str(e)}")
            self.daily_stats = {}
    
    def save_statistics(self):
        """Save statistics to file"""
        try:
            os.makedirs("data", exist_ok=True)
            # Convert sets to lists for JSON serialization
            stats_to_save = {}
            for user_email, user_data in self.daily_stats.items():
                stats_to_save[user_email] = {}
                for date, daily_data in user_data.items():
                    daily_copy = daily_data.copy()
                    if "languages_used" in daily_copy:
                        daily_copy["languages_used"] = list(daily_copy["languages_used"])
                    stats_to_save[user_email][date] = daily_copy
            
            with open("data/daily_stats.json", "w") as f:
                json.dump(stats_to_save, f, indent=2)
        except Exception as e:
            self.logger.error(f"Failed to save statistics: {str(e)}")
    
    def _get_motivational_message(self, solved_today: int, target: int) -> str:
        """Generate motivational message based on progress"""
        if solved_today >= target:
            messages = [
                "🎉 Amazing! You've hit your daily target!",
                "🔥 You're on fire! Great job completing your goal!",
                "⭐ Excellent work! You've achieved your daily target!",
                "💪 Outstanding! You're crushing your coding goals!"
            ]
        elif solved_today > 0:
            remaining = target - solved_today
            messages = [
                f"👏 Great start! Just {remaining} more problem{'s' if remaining > 1 else ''} to reach your goal!",
                f"🚀 You're making progress! {remaining} problem{'s' if remaining > 1 else ''} left for today!",
                f"💼 Keep it up! {remaining} more to complete your daily target!"
            ]
        else:
            messages = [
                "☀️ Ready to start your coding journey today?",
                "🌟 A new day, a new opportunity to grow!",
                "🎯 Let's tackle some problems and level up!",
                "💡 Time to challenge yourself with some coding!"
            ]
        
        import random
        return random.choice(messages)
    
    def get_user_stats(self, user_email: str, days: int = 30) -> Dict:
        """Get user statistics for the last N days"""
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        stats = {
            "period_days": days,
            "total_problems": 0,
            "total_pushes": 0,
            "languages_used": set(),
            "difficulties": {"Easy": 0, "Medium": 0, "Hard": 0},
            "daily_data": {},
            "streak": 0,
            "longest_streak": 0
        }
        
        if user_email in self.daily_stats:
            current_streak = 0
            longest_streak = 0
            yesterday = datetime.now() - timedelta(days=1)
            
            for i in range(days):
                date = (start_date + timedelta(days=i)).strftime('%Y-%m-%d')
                if date in self.daily_stats[user_email]:
                    daily_data = self.daily_stats[user_email][date]
                    stats["total_problems"] += daily_data["problems_solved"]
                    stats["total_pushes"] += daily_data["total_pushes"]
                    stats["languages_used"].update(daily_data["languages_used"])
                    
                    for difficulty, count in daily_data["difficulties"].items():
                        stats["difficulties"][difficulty] += count
                    
                    stats["daily_data"][date] = daily_data["problems_solved"]
                    
                    # Calculate streaks
                    if daily_data["problems_solved"] > 0:
                        current_streak += 1
                        longest_streak = max(longest_streak, current_streak)
                    else:
                        current_streak = 0
        
        stats["languages_used"] = list(stats["languages_used"])
        stats["longest_streak"] = longest_streak
        
        # Check if current streak continues to today
        today = datetime.now().strftime('%Y-%m-%d')
        if (user_email in self.daily_stats and 
            today in self.daily_stats[user_email] and
            self.daily_stats[user_email][today]["problems_solved"] > 0):
            stats["streak"] = current_streak
        else:
            stats["streak"] = 0
        
        return stats
    
    def cleanup_old_data(self, days_to_keep: int = 90):
        """Clean up old statistical data"""
        cutoff_date = datetime.now() - timedelta(days=days_to_keep)
        cutoff_str = cutoff_date.strftime('%Y-%m-%d')
        
        cleaned_count = 0
        for user_email in list(self.daily_stats.keys()):
            for date_str in list(self.daily_stats[user_email].keys()):
                if date_str < cutoff_str:
                    del self.daily_stats[user_email][date_str]
                    cleaned_count += 1
        
        if cleaned_count > 0:
            self.save_statistics()
            self.logger.info(f"Cleaned up {cleaned_count} old statistical records")
        
        return {"cleaned_records": cleaned_count}