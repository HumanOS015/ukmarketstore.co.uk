import { Toaster } from "@/components/ui/toaster"
import { lazy, Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { TabMemoryProvider } from "@/lib/TabMemoryContext";
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Layout from './components/Layout';
import { WishlistProvider } from "@/lib/WishlistContext";

const PageFallback = (
  <div className="flex items-center justify-center py-20">
    <div className="w-6 h-6 border-4 border-muted border-t-primary rounded-full animate-spin" />
  </div>
);

const Home = lazy(() => import("./pages/Home"));
const Sell = lazy(() => import("./pages/Sell"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Orders = lazy(() => import("./pages/Orders"));
const Profile = lazy(() => import("./pages/Profile"));
const BuyerProtection = lazy(() => import("./pages/BuyerProtection"));
const TermsAndConditions = lazy(() => import("./pages/TermsAndConditions"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const SellerDashboard = lazy(() => import("./pages/SellerDashboard"));
const About = lazy(() => import("./pages/About"));
const BuyerProtectionAssistant = lazy(() => import("./pages/BuyerProtectionAssistant"));
const Admin = lazy(() => import("./pages/Admin"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const SellerStorefront = lazy(() => import("./pages/SellerStorefront"));
const SellerMessages = lazy(() => import("./pages/SellerMessages"));
const Returns = lazy(() => import("./pages/Returns"));
const Account = lazy(() => import("./pages/mobile/Account"));
const Categories = lazy(() => import("./pages/mobile/Categories"));
const MobileSearch = lazy(() => import("./pages/mobile/Search"));
const Category = lazy(() => import("./pages/Category"));
const Notifications = lazy(() => import("./pages/Notifications"));
const OAuthConsent = lazy(() => import("./pages/OAuthConsent"));

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // The OAuth consent page handles its own signed-out redirect (preserving the
  // MCP ctx handle), so it must render outside the auth gate below — a guard
  // would strip the ctx context before the page can carry it into returnTo.
  if (window.location.pathname === "/oauth/consent") {
    return (
      <Routes>
        <Route path="/oauth/consent" element={<Suspense fallback={PageFallback}><OAuthConsent /></Suspense>} />
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
      <TabMemoryProvider>
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
        <Route path="/messages" element={<SellerMessages />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/category/:category" element={<Category />} />
        <Route path="/account" element={<Account />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/search" element={<MobileSearch />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
        </Routes>
      </TabMemoryProvider>
    </WishlistProvider>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </ThemeProvider>
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App