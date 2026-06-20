import { useState, useEffect } from "react";
import { signIn } from "../utils/auth";
import { CheckCircle } from "lucide-react";

interface LoginPanelProps {
  onLoginSuccess: () => void;
}

export function LoginPanel({ onLoginSuccess }: LoginPanelProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [loginSuccess, setLoginSuccess] = useState(false);
  const [loggedName, setLoggedName] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!loginSuccess) return;
    const t1 = setTimeout(() => setProgress(100), 50);
    const t2 = setTimeout(() => onLoginSuccess(), 5300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [loginSuccess, onLoginSuccess]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signInError, data } = await signIn(
        username.trim(),
        password.trim(),
      );

      if (signInError) {
        setError(signInError.message || "Pogrešno korisničko ime ili lozinka");
        setLoading(false);
      } else {
        setLoggedName(data?.username ?? username);
        setLoading(false);
        setLoginSuccess(true);
        setProgress(0);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Greška: ${errorMsg}`);
      setLoading(false);
    }
  };

  const primary = "#785E9E";
  const primaryHover = "#684f8a";
  const primaryActive = "#574176";
  const accent = "#8FC74A";

  if (loginSuccess) {
    return (
      <div className="min-h-screen login-soft-bg flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-8 pt-8 pb-7 text-center">
              <div className="flex justify-center mb-4">
                <img
                  src={`${import.meta.env.BASE_URL}foto/LOGO_APLIKACIJE.png`}
                  alt="Logo aplikacije"
                  className="h-24 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <CheckCircle className="w-14 h-14 mx-auto mb-3" style={{ color: accent }} />
              <p className="text-xl font-bold mb-1 dark:text-[#ede9f6]" style={{ color: primary }}>
                Pristup odobren
              </p>
              {loggedName && (
                <p className="text-base font-semibold mb-1 uppercase" style={{ color: accent }}>
                  {loggedName}
                </p>
              )}
              <p className="text-sm text-gray-400 dark:text-[#5f5878] mb-6">Učitavanje aplikacije...</p>
              <div className="w-full bg-gray-100 dark:bg-[#1e1a2d] rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: `${progress}%`,
                    transition: "width 5s cubic-bezier(0.4, 0, 0.2, 1)",
                    background: `linear-gradient(90deg, ${primary}, ${accent})`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen login-soft-bg flex items-center justify-center p-4 md:p-6 lg:p-8">
      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl">
        <div className="bg-white dark:bg-[#261f38] rounded-2xl shadow-2xl p-8 md:p-10 lg:p-12 border-2 border-transparent dark:border-[#2d2648]">
          <div className="flex justify-center mb-8">
            <div className="w-40 h-40 md:w-52 md:h-52 flex items-center justify-center">
              <img
                src={`${import.meta.env.BASE_URL}foto/LOGO_APLIKACIJE.png`}
                alt="Logo aplikacije"
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
