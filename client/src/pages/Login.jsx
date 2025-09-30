import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setEmail("");
    setPassword("");

    try {
      const response = await fetch("http://localhost:4000/auth/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({email, password})
      });

      const data = await response.json();

      localStorage.setItem('token', data.token)
      navigate("/dashboard")

    } catch (error) {
      console.log("Error logging in,", error.message)
    }
  }

  // button to log in
  // function ot handle log in
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