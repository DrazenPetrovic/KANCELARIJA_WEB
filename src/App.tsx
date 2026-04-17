import { useEffect, useState } from "react";
import { LoginPanel } from "./components/LoginPanel";
import { Dashboard } from "./components/Dashboard";
import { verifyAuth, signOut } from "./utils/auth";
import { PrintProvider } from "./context/PrintContext";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [vrstaRadnika, setVrstaRadnika] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const user = await verifyAuth();
      if (user) {
        setUsername(user.username);
        setVrstaRadnika(user.vrstaRadnika);
        setIsAuthenticated(true);
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  const handleLoginSuccess = async () => {
    const user = await verifyAuth();
    if (user) {
      setUsername(user.username);
      setVrstaRadnika(user.vrstaRadnika);
      setIsAuthenticated(true);
    }
  };

  const handleLogout = async () => {
    await signOut();
    setIsAuthenticated(false);
    setUsername("");
    setVrstaRadnika(0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Učitavanje...
      </div>
    );
  }

  return (
    <PrintProvider>
      {isAuthenticated ? (
        <Dashboard
          username={username}
          vrstaRadnika={vrstaRadnika}
          onLogout={handleLogout}
        />
      ) : (
        <LoginPanel onLoginSuccess={handleLoginSuccess} />
      )}
    </PrintProvider>
  );
}

export default App;
