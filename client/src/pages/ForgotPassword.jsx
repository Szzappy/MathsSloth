import { useState } from 'react'

function ForgotPassword() {
  const [email, setEmail] = useState("");

  const handleReset = async (e) => {
    e.preventDefault();
    // Call the API to send the reset link
    const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/password/reset/email`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({email})
    });
    const data = await response.json();
    if (response.ok) {
      alert(data.message || "If that email exists, a reset link has been sent.");
    } else {
      alert(data.error || "An error occurred. Please try again.");
    }
  }

  return (
    <div>
      <h1>Forgot Password</h1>
      <p>Please enter your email address to reset your password.</p>
      <form onSubmit={(e) => {handleReset(e)}}>
        <input type="email" placeholder="Email" onChange={(e) => setEmail(e.target.value)} required />
        <button type="submit">Send Reset Link</button>
      </form>
    </div>
  )
}

export default ForgotPassword
