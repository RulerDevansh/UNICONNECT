import { Outlet, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ListingDetail from './pages/ListingDetail';
import CreateListing from './pages/CreateListing';
import CreateRental from './pages/CreateRental';
import BillShare from './pages/BillShare';
import MySharing from './pages/MySharing';
import MyListings from './pages/MyListings';
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminListings from './pages/admin/AdminListings';
import AdminUsers from './pages/admin/AdminUsers';
import AdminDisputes from './pages/admin/AdminDisputes';
import Chat from './pages/Chat';
import Marketplace from './pages/Marketplace';
import EditListing from './pages/EditListing';
import UserHistory from './pages/UserHistory';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import RentalPage from './pages/RentalPage';
import ProtectedRoute from './components/ProtectedRoute';
import AIAssistantWidget from './components/AIAssistantWidget';

const DefaultLayout = () => (
  <div className="min-h-screen bg-slate-950/70 text-slate-100">
    <Navbar />
    <Outlet />
    <AIAssistantWidget />
  </div>
);

const App = () => {
  return (
    <Routes>
      <Route element={<DefaultLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/listings/:id" element={<ListingDetail />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/listings/new" element={<CreateListing />} />
          <Route path="/rentals/new" element={<CreateRental />} />
          <Route path="/listings/:id/edit" element={<EditListing />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/my-sharing" element={<MySharing />} />
          <Route path="/shares" element={<BillShare />} />
          <Route path="/my-listings" element={<MyListings />} />
          <Route path="/rentals" element={<RentalPage />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/history" element={<UserHistory />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>
        <Route element={<ProtectedRoute roles={["admin"]} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="listings" element={<AdminListings />} />
            <Route path="disputes" element={<AdminDisputes />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>
        </Route>
        <Route path="*" element={<p className="p-10 text-center text-slate-500">Page not found</p>} />
      </Route>
    </Routes>
  );
};

export default App;
