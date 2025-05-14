// JWT configuration

const jwtConfig = {
  secret:
    process.env.JWT_SECRET ||
    "quizlingo_jwt_secret_key_for_secure_authentication",
  expiresIn: "1d", // Token expiration time: 1 day
};

export default jwtConfig;
