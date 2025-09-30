import React, {useState} from 'react';
import { useNavigate, Link } from "react-router";

function Register() {
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL;
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(""); // hide the passwords and add a retype password functionality to it

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUsername("");
    setEmail("");
    setPassword("");

    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({username, email, password})
      })

      // backend returns a token
      const data = await response.json();
      // get the token from data object and store in local storage
      localStorage.setItem('token', data.token);

      navigate("/dashboard");
    } catch (error) {
      console.error(error.message)
    }
  }

  return (<>
  <h1>Register</h1>
  <form onSubmit={handleSubmit}>
    <input
      type='text'
      value={username}
      onChange={(e) => setUsername(e.target.value)}
      placeholder='username...'
      required
    />
    <input
      type='text'
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      placeholder='email...'
      required
    />
    <input
      type='password'
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      placeholder='password...'
      required
    />
    
    <button type="submit" style={{marginLeft: "1rem", padding: "0.5rem 1rem" }}>
      Register
    </button>
  </form>
  <div>
    <p>
      Already have an account? {' '}
      <Link to="/login">
        Login
      </Link>
    </p>
  </div>
  </>)
}

export default Register
