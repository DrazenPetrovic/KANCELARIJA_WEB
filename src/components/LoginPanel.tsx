import { useState } from "react";
import { signIn } from "../utils/auth";

interface LoginPanelProps {
  onLoginSuccess: () => void;
}

export function LoginPanel({ onLoginSuccess }: LoginPanelProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signInError } = await signIn(
        username.trim(),
        password.trim(),
      );

      if (signInError) {
        setError(signInError.message || "Pogrešno korisničko ime ili lozinka");
      } else {
        onLoginSuccess();
      }
    } catch (err) {
      console.error("Login error:", err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Greška: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4 md:p-6 lg:p-8">
      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl">
        <div className="bg-white rounded-2xl shadow-2xl p-8 md:p-10 lg:p-12">
          <div className="flex justify-center mb-8">
            <div className="w-32 h-32 md:w-40 md:h-40 flex items-center justify-center">
              <img
                src="/foto/karpas_logo_software.png"
                alt="Karpas Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  const parent = target.parentElement;
                  if (parent) {
                    parent.innerHTML = `<div class="bg-[#3B5998] p-5 md:p-6 rounded-full"><svg class="w-10 h-10 md:w-12 md:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg></div>`;
                  }
                }}
              />
            </div>
          </div>

          <h1 className="text-center text-2xl font-bold text-gray-800 mb-2">
            Kancelarija
          </h1>
          <p className="text-center text-gray-500 mb-8">Karpas Ambalaže</p>

          <form
            onSubmit={handleLogin}
            autoComplete="on"
            className="space-y-5 md:space-y-6"
          >
            <div>
              <label
                htmlFor="username"
                className="block text-base md:text-lg font-medium text-gray-700 mb-3"
              >
                Korisničko ime
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Unesite korisničko ime"
                className="w-full px-5 py-4 md:px-6 md:py-5 text-base md:text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-4 transition"
                style={
                  {
                    "--tw-ring-color": "#3B5998",
                    borderColor: "rgb(209 213 219)",
                  } as React.CSSProperties
                }
                onFocus={(e) => (e.target.style.borderColor = "#3B5998")}
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgb(209 213 219)")
                }
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-base md:text-lg font-medium text-gray-700 mb-3"
              >
                Lozinka
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Unesite lozinku"
                className="w-full px-5 py-4 md:px-6 md:py-5 text-base md:text-lg border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-4 transition"
                style={
                  {
                    "--tw-ring-color": "#3B5998",
                    borderColor: "rgb(209 213 219)",
                  } as React.CSSProperties
                }
                onFocus={(e) => (e.target.style.borderColor = "#3B5998")}
                onBlur={(e) =>
                  (e.target.style.borderColor = "rgb(209 213 219)")
                }
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-5 py-4 rounded-xl text-base md:text-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold py-4 md:py-5 text-lg md:text-xl rounded-xl transition-all transform active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              style={{ backgroundColor: "#3B5998" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = "#2d4373")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "#3B5998")
              }
              onMouseDown={(e) =>
                (e.currentTarget.style.backgroundColor = "#1f2f50")
              }
              onMouseUp={(e) =>
                (e.currentTarget.style.backgroundColor = "#2d4373")
              }
            >
              {loading ? "Prijava u toku..." : "Prijava"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
