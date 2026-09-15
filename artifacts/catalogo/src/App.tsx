import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Route, Switch, Router as WouterRouter } from "wouter";

import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { CartProvider } from "@/contexts/CartContext";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Analytics } from "@vercel/analytics/react";

const queryClient = new QueryClient();
const Admin = lazy(() =>
  import("@/pages/Admin").then((module) => ({ default: module.Admin })),
);
const ProductDetail = lazy(() =>
  import("@/pages/ProductDetail").then((module) => ({
    default: module.ProductDetail,
  })),
);

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/producto/:slug" component={ProductDetail} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <CartProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Layout>
                <Suspense
                  fallback={
                    <div
                      className="py-20 text-center text-sm text-gray-600"
                      role="status"
                    >
                      Cargando módulo...
                    </div>
                  }
                >
                  <Router />
                </Suspense>
              </Layout>
            </WouterRouter>
            <Analytics />
            <Toaster />
          </TooltipProvider>
        </CartProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  );
}

export default App;
