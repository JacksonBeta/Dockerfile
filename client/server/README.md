sha<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hollywood Weekly Login</title>
  <style>
    body {
      background-color: #121212;
      color: #fff;
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .login-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-grow: 1;
    }
    .login-box {
      background-color: #1e1e1e;
      border-radius: 8px;
      padding: 30px;
      max-width: 400px;
      width: 100%;
      box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    }
    h1 {
      font-size: 24px;
      text-align: center;
      margin-bottom: 10px;
      color: #4a6cf7;
    }
    .subtitle {
      font-size: 18px;
      text-align: center;
      margin-bottom: 25px;
      color: #ccc;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
      color: #ddd;
    }
    input {
      width: 100%;
      padding: 12px;
      border: 1px solid #444;
      background-color: #2d2d2d;
      color: #fff;
      border-radius: 4px;
      box-sizing: border-box;
    }
    input:focus {
      outline: none;
      border-color: #4a6cf7;
    }
    button {
      width: 100%;
      padding: 12px;
      margin-bottom: 10px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
      font-size: 16px;
    }
    .btn-login {
      background-color: #4a6cf7;
      color: white;
      border: none;
    }
    .btn-demo {
      background-color: transparent;
      color: #4a6cf7;
      border: 1px solid #4a6cf7;
    }
    .btn-mobile {
      background-color: #333;
      color: white;
      border: 1px solid #555;
    }
    .btn-admin {
      background-color: #ffc107;
      color: #333;
      border: none;
    }
    .btn-copyright {
      background-color: #dc3545;
      color: white;
      border: none;
    }
    .divider {
      display: flex;
      align-items: center;
      margin: 15px 0;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid #444;
    }
    .divider-text {
      padding: 0 10px;
      color: #999;
    }
    .footer {
      text-align: center;
      padding-top: 20px;
      color: #777;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="login-area">
      <div class="login-box">
        <h1>HOLLYWOOD WEEKLY</h1>
        <p class="subtitle">Distribute your films to major streaming platforms</p>
        
        <form id="login-form">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" placeholder="Enter your username">
          </div>
          
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" placeholder="Enter your password">
          </div>
          
          <button type="submit" class="btn-login">Login</button>
          
          <div class="divider">
            <span class="divider-text">OR</span>
          </div>
          
          <button type="button" id="demo-btn" class="btn-demo">Try Demo Account</button>
          <button type="button" id="mobile-btn" class="btn-mobile">Mobile-Friendly Demo →</button>
          <button type="button" id="admin-btn" class="btn-admin">Admin Demo Access</button>
          
          <div class="divider">
            <span class="divider-text" style="color: #dc3545;">COPYRIGHT REGISTRATION</span>
          </div>
          
          <button type="button" id="copyright-btn" class="btn-copyright">GET COPYRIGHT REGISTRATION CODE</button>
        </form>
      </div>
    </div>
    
    <div class="footer">
      © 2025 Hollywood Weekly Magazine. All rights reserved.<br>
      Protected by Hollywood Weekly Distribution Platform
    </div>
  </div>
  
  <script>
    document.getElementById('login-form').addEventListener('submit', function(e) {
      e.preventDefault();
      alert('Login functionality will be implemented soon');
    });
    
    document.getElementById('demo-btn').addEventListener('click', function() {
      alert('Demo account will be available soon');
    });
    
    document.getElementById('mobile-btn').addEventListener('click', function() {
      alert('Mobile demo will be available soon');
    });
    
    document.getElementById('admin-btn').addEventListener('click', function() {
      alert('Admin access will be available soon');
    });
    
    document.getElementById('copyright-btn').addEventListener('click', function() {
      alert('Copyright registration access will be available soon');
    });
  </script>
</body>
</html>red/README.md
