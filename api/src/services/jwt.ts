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

/**
 * Passwordless signup: proof that the bearer received the otp for a phone or
 * email that has no account yet, held while they type their name. Signed with
 * its own key, not JWT_PASSWORD, so it can never be presented as a login
 * session to isAuthenticated.
 */
const signupSecret = () => `${process.env.JWT_PASSWORD || ""}:otp-signup`;

export interface SignupTokenData {
  kind: "phone" | "email";
  value: string;
}

export const createSignupToken = (data: SignupTokenData) =>
  jwt.sign(data, signupSecret(), { expiresIn: "15m" });

export const verifySignupToken = (token: string) =>
  new Promise<SignupTokenData | null>((resolve) => {
    jwt.verify(token, signupSecret(), (err, decoded) => {
      if (err || !decoded || typeof decoded === "string") return resolve(null);
      const { kind, value } = decoded as SignupTokenData;
      resolve((kind === "phone" || kind === "email") && value ? { kind, value } : null);
    });
  });
