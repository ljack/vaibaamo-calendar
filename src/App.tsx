import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import EventsList from './pages/EventsList'
import EventDetails from './pages/EventDetails'
import CreateEvent from './pages/CreateEvent'
import EditEvent from './pages/EditEvent'


function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<EventsList />} />
            <Route path="events/new" element={<CreateEvent />} />
            <Route path="events/:id" element={<EventDetails />} />
            <Route path="events/:id/edit" element={<EditEvent />} />
            <Route path="login" element={<Login />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
