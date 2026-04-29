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

  const primary = "#785E9E";
  const primaryHover = "#684f8a";
  const primaryActive = "#574176";
  const accent = "#8FC74A";

  return (
    <div className="min-h-screen login-soft-bg flex items-center justify-center p-4 md:p-6 lg:p-8">
      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl">
        <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl p-8 md:p-10 lg:p-12 border-2 border-transparent dark:border-[#2d2648]">
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
                    parent.innerHTML = `<div style="background:${primary}" class="p-5 md:p-6 rounded-full"><svg class="w-10 h-10 md:w-12 md:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg></div>`;
                  }
                }}
              />
            </div>
          </div>

          <h1 className="text-center text-2xl font-bold text-gray-800 dark:text-[#ede9f6] mb-2">
            Kancelarija
          </h1>
          <p className="text-center mb-8" style={{ color: primary }}>
            Karpas Ambalaže
          </p>

          <form
            onSubmit={handleLogin}
            autoComplete="on"
            className="space-y-5 md:space-y-6"
          >
            <div>
              <label
                htmlFor="username"
                className="block text-base md:text-lg font-medium text-gray-700 dark:text-[#c5bfd8] mb-3"
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
                className="w-full px-5 py-4 md:px-6 md:py-5 text-base md:text-lg border-2 border-gray-300 dark:border-[#3a3158] rounded-xl focus:outline-none focus:ring-4 transition bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
                style={
                  {
                    "--tw-ring-color": `${primary}55`,
                  } as React.CSSProperties
                }
                onFocus={(e) => (e.target.style.borderColor = primary)}
                onBlur={(e) =>
                  (e.target.style.borderColor = "")
                }
                required
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-base md:text-lg font-medium text-gray-700 dark:text-[#c5bfd8] mb-3"
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
                className="w-full px-5 py-4 md:px-6 md:py-5 text-base md:text-lg border-2 border-gray-300 dark:border-[#3a3158] rounded-xl focus:outline-none focus:ring-4 transition bg-white dark:bg-[#1e1a2d] text-gray-800 dark:text-[#ede9f6] placeholder:text-gray-400 dark:placeholder:text-[#5f5878]"
                style={
                  {
                    "--tw-ring-color": `${primary}55`,
                  } as React.CSSProperties
                }
                onFocus={(e) => (e.target.style.borderColor = primary)}
                onBlur={(e) =>
                  (e.target.style.borderColor = "")
                }
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/50 border-2 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 px-5 py-4 rounded-xl text-base md:text-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-white font-semibold py-4 md:py-5 text-lg md:text-xl rounded-xl transition-all transform active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              style={{ backgroundColor: primary }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = primaryHover)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = primary)
              }
              onMouseDown={(e) =>
                (e.currentTarget.style.backgroundColor = primaryActive)
              }
              onMouseUp={(e) =>
                (e.currentTarget.style.backgroundColor = primaryHover)
              }
            >
              {loading ? "Prijava u toku..." : "Prijava"}
            </button>

            <div
              className="h-1 w-full rounded-full"
              style={{ background: accent }}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
