// JWT configuration

const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: "1d",
};

export default jwtConfig;
