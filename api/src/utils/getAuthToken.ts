import { Request } from "express";

export const getAuthToken = (req: Request) : string | null => {
  const authHeader = req.headers["authorization"];
  
  if(!authHeader) {
    if(req.cookies.refreshToken) return req.cookies.refreshToken;
    return null;
  }

  let token : null | string = null;
  if(authHeader.includes(" ")) {
   token = authHeader.split(" ")[1];
  } else {
    token = authHeader;
  }

  if (!token) {
    return null;
  }

  return token;
};
