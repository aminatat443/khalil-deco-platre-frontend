import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-12 text-[#202923]">
      <div className="w-full max-w-lg border-t border-[#dfe5df] pt-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#315c40]">Khalil Déco Plâtre</p>
        <h1 className="mt-4 font-heading text-5xl font-semibold">404</h1>
        <p className="mt-3 text-lg text-[#626c65]">Cette page n’existe pas.</p>
        <a href="/" className="mt-6 inline-flex min-h-11 items-center justify-center bg-[#294b35] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#203d2a] motion-reduce:transition-none">
          Retour à l’accueil
        </a>
      </div>
    </main>
  );
};

export default NotFound;
