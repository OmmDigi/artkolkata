import jwt from "jsonwebtoken";

type JwtVerifyReturnType<D, E> = {
  data: D | null;
  error: E | null;
};

export const createToken = (payload: object, options?: jwt.SignOptions) => {
  const jwtPassword = process.env.JWT_PASSWORD || "";

  return jwt.sign(payload, jwtPassword, options);
};

export const verifyToken = <D, E = jwt.VerifyErrors | null>(token: string) => {
  const jwtPassword = process.env.JWT_PASSWORD || "";

  return new Promise((resolve: (value: JwtVerifyReturnType<D, E>) => void) => {
    jwt.verify(token, jwtPassword, (err, decoded) => {
      if (err) return resolve({ error: err as E, data: null });
      return resolve({ error: null, data: decoded as D });
    });
  });
};
