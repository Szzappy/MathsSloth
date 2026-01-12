export default function(req, res, next) {
  const { email, username, password } = req.body;

  function validEmail(userEmail) {
    return /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(userEmail) && userEmail.length <= 255;
  }

  function securePassword(userPassword) {
    return /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])(?=.{8,})/.test(userPassword) && userPassword.length <= 255;
  }

  function validUsername(userName) {
    return typeof userName === 'string' && userName.length >= 3 && userName.length <= 30;
  }

  if (req.path === "/register") {
    if (![email, username, password].every(Boolean))
      return res.status(401).json("Missing Credentials");
    else if (!validEmail(email))
      return res.status(401).json("Invalid Email");
    else if (!securePassword(password))
      return res.status(401).json({error: "Password not secure enough, make sure to include 1 upper case, 1 number and 1 special character"});
    else if (!validUsername(username))
      return res.status(401).json("Invalid Username");
  } else if (req.path === "/login") {
    if (![email, password].every(Boolean))
      return res.status(401).json("Missing Credentials");
    else if (!validEmail(email))
      return res.status(401).json("Invalid Email");
  } else if (req.path === "/reset-password") {
    if (![password].every(Boolean))
      return res.status(401).json("Missing Credentials");
    else if (!securePassword(password))
      return res.status(401).json({error: "Password not secure enough, make sure to include 1 upper case, 1 number and 1 special character"});
  }

  // if we reach here, all is good
  // next() moves onto the next piece of middleware
  next();
};