from flask import Flask, request, jsonify
import requests
import os
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for browser extension

# Load from environment variables for security
CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "Ov23liSuRU6nVNxttjXc")
CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")  # Remove hardcoded secret

@app.route("/exchange_token", methods=["POST"])
def exchange_token():
    data = request.get_json()
    code = data.get("code")
    redirect_uri = data.get("redirect_uri")
    
    if not code:
        return jsonify({"error": "Missing code"}), 400
    
    if not CLIENT_SECRET:
        return jsonify({"error": "Server configuration error"}), 500

    # Exchange code for token
    token_url = "https://github.com/login/oauth/access_token"
    payload = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": code,
        "redirect_uri": redirect_uri
    }
    headers = {"Accept": "application/json"}

    try:
        r = requests.post(token_url, json=payload, headers=headers)
        r.raise_for_status()
        token_data = r.json()
        
        if "error" in token_data:
            return jsonify({"error": token_data.get("error_description", "OAuth error")}), 400
            
        return jsonify(token_data)
    except requests.RequestException as e:
        return jsonify({"error": "Failed to exchange token"}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)