// JWT configuration

const jwtConfig = {
  secret: process.env.JWT_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  expiresIn: "1d", // Access token expires in 1 day
  refreshExpiresIn: "7d", // Refresh token expires in 7 days
};

export default jwtConfig;
