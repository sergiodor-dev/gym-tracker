import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { AppDataProvider } from './AppDataContext'
import { ProtectedLayout, WelcomeLayout } from './components/RouteGuards'
import WelcomePage from './pages/WelcomePage'
import HomePage from './pages/HomePage'
import WorkoutPage from './pages/WorkoutPage'
import ExercisesPage from './pages/ExercisesPage'
import RoutinesPage from './pages/RoutinesPage'
import PlannerPage from './pages/PlannerPage'
import ProgressPage from './pages/ProgressPage'
import BackupPage from './pages/BackupPage'
import ProteinPage from './pages/ProteinPage'
import AccountPage from './pages/AccountPage'

export default function App() {
  return (
    <AuthProvider>
      <AppDataProvider>
        <HashRouter>
          <Routes>
            <Route path="/welcome" element={<WelcomeLayout><WelcomePage /></WelcomeLayout>} />

            {/* Rutas privadas: ProtectedLayout redirige a /welcome si no hay sesión */}
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/train" element={<WorkoutPage />} />
              <Route path="/exercises" element={<ExercisesPage />} />
              <Route path="/routines" element={<RoutinesPage />} />
              <Route path="/planner" element={<PlannerPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/backup" element={<BackupPage />} />
              <Route path="/protein" element={<ProteinPage />} />
              <Route path="/account" element={<AccountPage />} />
            </Route>

            {/* Cualquier otra URL pasa por Inicio (y, sin sesión, de ahí a Bienvenida) */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </AppDataProvider>
    </AuthProvider>
  )
}
