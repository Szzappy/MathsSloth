import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRemember] = useState(false);

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setEmail("");
    setPassword("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({email, password, rememberMe})
      });

      const data = await response.json();

      if (data.token) {
        localStorage.setItem('token', data.token)
        navigate("/dashboard")
      }

    } catch (error) {
      console.log("Error logging in,", error.message)
    }
  }

  // button to log in
  // function to handle log in
  return (<>
    <form onSubmit={handleLogin}>
      <h1>Login</h1>
      <input
        type='text'
        value={email}
        placeholder="email..."
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input 
        type='password'
        value={password}
        placeholder='password...'
        onChange={(e) => setPassword(e.target.value)}
      />
      
      <button type="submit" style={{marginLeft: "1rem", padding: "0.5rem 1rem"}}>
        Login
      </button>

      <br></br>

      <label>
        <input
          type="checkbox"
          checked={rememberMe}
          onChange={(e) => setRemember(e.target.checked)}
        />
        Remember me
      </label>
    </form>
    <div>
      <p>Don't have an account? {' '}
        <Link to="/register">
        Register
        </Link>
      </p>
    </div>
  </>)
}

export default Login;