import {useState} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom';

function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  console.log("Reset token:", token);
  window.history.replaceState({}, '', '/reset-password'); // remove error param from URL
  

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/auth/reset-password`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({password, confirmPassword, token})
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Password reset successful");
        navigate('/login');
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch (error) {
      setError("An error occurred. Please try again later.");
    } finally {
      setPassword('');
      setConfirmPassword('');
    }
  };
  
  return (
    <div>
      <h1>Reset Password Page</h1>
      <p>This is where users can reset their passwords.</p>
      <p>{error}</p>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password">New Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="confirmPassword">Confirm Password:</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <button type="submit">Reset Password</button>
      </form>

    </div>
  )
}

export default ResetPassword
