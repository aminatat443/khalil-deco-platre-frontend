import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import PublicQuote from "./pages/PublicQuote";
import PublicInvoice from "./pages/PublicInvoice";
import HelpWidget from "./components/HelpWidget";
import { ConfirmProvider } from "./components/confirm-dialog";
import { useTheme } from "./lib/theme";

const queryClient = new QueryClient();

const App = () => {
  const theme = useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ConfirmProvider>
          <Toaster
            theme={theme}
            position="top-right"
            closeButton
            richColors
            gap={12}
            visibleToasts={3}
            duration={3500}
            className="kdp-toaster"
            offset={{ top: 20, right: 20 }}
            mobileOffset={{ top: 12, right: 12, left: 12 }}
            toastOptions={{
              classNames: {
                toast: "kdp-toast",
                title: "kdp-toast-title",
                description: "kdp-toast-description",
                closeButton: "kdp-toast-close",
              },
            }}
          />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/devis/:number/:token" element={<PublicQuote />} />
              <Route path="/facture/:number/:token" element={<PublicInvoice />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            <HelpWidget />
          </BrowserRouter>
        </ConfirmProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
