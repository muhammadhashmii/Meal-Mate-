import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import Home from "./pages/Home";
import CrowdMonitor from "./pages/CrowdMonitor";
import Cart from "./pages/Cart";
import Payment from "./pages/Payment";
import QRConfirmation from "./pages/QRConfirmation";
import RateMeal from "./pages/RateMeal";
import OrderHistory from "./pages/OrderHistory";
import CancelOrder from "./pages/CancelOrder";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<AppLayout><Home /></AppLayout>} />
              <Route path="/cart" element={<AppLayout><Cart /></AppLayout>} />
              <Route path="/payment" element={<AppLayout><Payment /></AppLayout>} />
              <Route path="/qr-confirmation" element={<AppLayout><QRConfirmation /></AppLayout>} />
              <Route path="/rate-meal" element={<AppLayout><RateMeal /></AppLayout>} />
              <Route path="/order-history" element={<AppLayout><OrderHistory /></AppLayout>} />
              <Route path="/cancel-order" element={<AppLayout><CancelOrder /></AppLayout>} />
              <Route path="/crowd-monitor" element={<AppLayout><CrowdMonitor /></AppLayout>} />
              <Route path="/profile" element={<AppLayout><Profile /></AppLayout>} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
