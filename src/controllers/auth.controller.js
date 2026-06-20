import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import * as AuthService from "../services/auth.service.js";

export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Korisničko ime i šifra su obavezni",
      });
    }

    let result;
    try {
      result = await AuthService.login(username, password);
    } catch (dbError) {
      console.error("Database connection/procedure error:", dbError);
      return res.status(503).json({
        success: false,
        message: "Baza podataka nije dostupna. Kontaktiraj administratora.",
      });
    }

    if (result.success) {
      res.cookie("authToken", result.token, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        message: "Uspješno logovanje",
        user: result.user,
      });
    }

    return res.status(401).json({
      success: false,
      message: "Pogrešno korisničko ime ili šifra",
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahteva",
    });
  }
};

export const verify = (req, res) => {
  try {
    const token = req.cookies.authToken;

    if (!token) {
      return res.status(401).json({
        authenticated: false,
        error: "Not authenticated",
      });
    }

    const verified = jwt.verify(token, env.JWT_SECRET);
    return res.json({
      authenticated: true,
      username: verified.username,
      sifraRadnika: verified.sifraRadnika,
      vrstaRadnika: verified.vrstaRadnika,
    });
  } catch (error) {
    console.error("Verification error:", error);
    return res.status(401).json({
      authenticated: false,
      error: "Invalid token",
    });
  }
};

export const logout = (req, res) => {
  res.clearCookie("authToken");
  return res.json({ success: true, message: "Logged out" });
};
