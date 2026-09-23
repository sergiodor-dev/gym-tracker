import { HashRouter, Routes, Route } from 'react-router-dom'
import { AppDataProvider } from './AppDataContext'
import BottomNav from './components/BottomNav'
import HomePage from './pages/HomePage'
import WorkoutPage from './pages/WorkoutPage'
import ExercisesPage from './pages/ExercisesPage'
import RoutinesPage from './pages/RoutinesPage'
import PlannerPage from './pages/PlannerPage'
import ProgressPage from './pages/ProgressPage'
import BackupPage from './pages/BackupPage'

export default function App() {
  return (
    <AppDataProvider>
      {/* HashRouter para que funcione directamente en GitHub Pages sin configuración extra */}
      <HashRouter>
        <div className="app-shell">
          <main className="main">
            <div className="app">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/train" element={<WorkoutPage />} />
                <Route path="/exercises" element={<ExercisesPage />} />
                <Route path="/routines" element={<RoutinesPage />} />
                <Route path="/planner" element={<PlannerPage />} />
                <Route path="/progress" element={<ProgressPage />} />
                <Route path="/backup" element={<BackupPage />} />
              </Routes>
            </div>
          </main>
          <BottomNav />
        </div>
      </HashRouter>
    </AppDataProvider>
  )
}
