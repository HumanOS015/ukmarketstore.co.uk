import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import Home from './pages/Home';
import Sell from './pages/Sell';
import ProductDetail from './pages/ProductDetail';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import BuyerProtection from './pages/BuyerProtection';
import TermsAndConditions from './pages/TermsAndConditions';
import PrivacyPolicy from './pages/PrivacyPolicy';
import SellerDashboard from './pages/SellerDashboard';
import About from './pages/About';
import BuyerProtectionAssistant from './pages/BuyerProtectionAssistant';
import Admin from './pages/Admin';
import Wishlist from './pages/Wishlist';
import SellerStorefront from './pages/SellerStorefront';
import Returns from './pages/Returns';
import Category from './pages/Category';
import { WishlistProvider } from '@/lib/WishlistContext';
import OAuthConsent from './pages/OAuthConsent';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // The OAuth consent page handles its own signed-out redirect (preserving the
  // MCP ctx handle), so it must render outside the auth gate below — a guard
  // would strip the ctx context before the page can carry it into returnTo.
  if (window.location.pathname === "/oauth/consent") {
    return (
      <Routes>
        <Route path="/oauth/consent" element={<OAuthConsent />} />
      </Routes>
    );
  }

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <WishlistProvider>
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/sell" element={<Sell />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/buyer-protection" element={<BuyerProtection />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/seller-dashboard" element={<SellerDashboard />} />
        <Route path="/about" element={<About />} />
        <Route path="/buyer-protection-assistant" element={<BuyerProtectionAssistant />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/seller/:email" element={<SellerStorefront />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/category/:category" element={<Category />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
    </Routes>
    </WishlistProvider>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App