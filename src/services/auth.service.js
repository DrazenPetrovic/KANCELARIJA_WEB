import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { withConnection } from "./db.service.js";

export const login = async (username, password) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL logovanje_korisnika(?, ?)", [
      username,
      password,
    ]);

    const row = rows?.[0]?.[0] || null;

    const sifraRadnika = row?.povratna ?? null;
    const vrstaRadnika = row?.vrsta ?? null;

    if (sifraRadnika == null) return { success: false };
    if (sifraRadnika == 0) return { success: false };

    const token = jwt.sign(
      {
        username,
        sifraRadnika,
        vrstaRadnika,
        loginTime: new Date().toISOString(),
      },
      env.JWT_SECRET,
      { expiresIn: "8h" },
    );

    return {
      success: true,
      token,
      user: { username, sifraRadnika, vrstaRadnika },
    };
  });
};
