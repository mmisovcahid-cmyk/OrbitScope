import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/common/Layout';
import DashboardPage from './pages/DashboardPage';
import DetectionPage from './pages/DetectionPage';
import AnalysisPage from './pages/AnalysisPage';
import ComparisonPage from './pages/ComparisonPage';
import PlanetXPage from './pages/PlanetXPage';
import CatalogPage from './pages/CatalogPage';
import AboutPage from './pages/AboutPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/detection" element={<DetectionPage />} />
          <Route path="/analysis/:id" element={<AnalysisPage />} />
          <Route path="/comparison" element={<ComparisonPage />} />
          <Route path="/planetx" element={<PlanetXPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
