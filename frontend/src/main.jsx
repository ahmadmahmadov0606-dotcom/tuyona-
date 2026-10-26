import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { AuthProvider, RequireAuth } from './auth'
import Layout from './components/Layout'
import { Empty, ToastProvider } from './components/ui'
import Home from './pages/Home'
import Search from './pages/Search'
import ListingPage from './pages/ListingPage'
import { Login, Register } from './pages/Auth'
import { Favorites, MyBookings } from './pages/Client'
import VendorDashboard from './pages/vendor/Dashboard'
import ListingForm from './pages/vendor/ListingForm'
import Admin from './pages/admin/Admin'
import Law from './pages/Law'
import PhotoCredits from './pages/PhotoCredits'
import MapPage from './pages/MapPage'
import Fitting from './pages/Fitting'
import CarPage from './pages/CarPage'
import './styles.css'
import Icon from './components/Icon'

function NotFound() {
  return (
    <div className="container page">
      <Empty icon={<Icon name="dove" />} title="Саҳифа ёфт нашуд" action={<Link to="/" className="btn btn-primary">Ба саҳифаи асосӣ</Link>} />
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="search" element={<Search />} />
              <Route path="listing/:id" element={<ListingPage />} />
              <Route path="qonun" element={<Law />} />
              <Route path="harita" element={<MapPage />} />
              <Route path="oroishgoh" element={<Fitting />} />
              <Route path="moshin/:id" element={<CarPage />} />
              <Route path="aksho" element={<PhotoCredits />} />
              <Route path="login" element={<Login />} />
              <Route path="register" element={<Register />} />
              <Route path="favorites" element={<RequireAuth><Favorites /></RequireAuth>} />
              <Route path="bookings" element={<RequireAuth><MyBookings /></RequireAuth>} />
              <Route path="vendor" element={<RequireAuth role="vendor"><VendorDashboard /></RequireAuth>} />
              <Route path="vendor/listings/new" element={<RequireAuth role="vendor"><ListingForm /></RequireAuth>} />
              <Route path="vendor/listings/:id" element={<RequireAuth role="vendor"><ListingForm /></RequireAuth>} />
              <Route path="admin" element={<RequireAuth role="admin"><Admin /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
