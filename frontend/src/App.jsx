import { Outlet, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ListingDetail from './pages/ListingDetail';
import CreateListing from './pages/CreateListing';
import BillShare from './pages/BillShare';
import MySharing from './pages/MySharing';
import MyListings from './pages/MyListings';
import AdminDashboard from './pages/AdminDashboard';
import Chat from './pages/Chat';
import Marketplace from './pages/Marketplace';
import EditListing from './pages/EditListing';
import UserHistory from './pages/UserHistory';
import BuyRequests from './pages/BuyRequests';
import MyBuyRequests from './pages/MyBuyRequests';
import Profile from './pages/Profile';
import ProtectedRoute from './components/ProtectedRoute';

const DefaultLayout = () => (
  <div className="min-h-screen bg-slate-950/70 text-slate-100">
    <Navbar />
    <Outlet />
  </div>
);

const App = () => {
  return (
    <Routes>
      <Route element={<DefaultLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/listings/:id" element={<ListingDetail />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/listings/new" element={<CreateListing />} />
          <Route path="/listings/:id/edit" element={<EditListing />} />
          <Route path="/marketplace" element={<Marketplace />} />
          <Route path="/my-sharing" element={<MySharing />} />
          <Route path="/shares" element={<BillShare />} />
          <Route path="/my-listings" element={<MyListings />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/history" element={<UserHistory />} />
          <Route path="/buy-requests" element={<BuyRequests />} />
          <Route path="/my-requests" element={<MyBuyRequests />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route element={<ProtectedRoute roles={["admin"]} />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>
        <Route path="*" element={<p className="p-10 text-center text-slate-500">Page not found</p>} />
      </Route>
    </Routes>
  );
};

export default App;
