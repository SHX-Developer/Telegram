import jwt from "jsonwebtoken";
import { env } from "./env";

export interface JwtPayload {
  userId: string;
}

const EXPIRES_IN = "30d";

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (typeof decoded === "string" || !decoded || typeof (decoded as JwtPayload).userId !== "string") {
    throw new Error("Invalid token payload");
  }
  return decoded as JwtPayload;
}
