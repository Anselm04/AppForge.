import Home from './pages/Home';
import Build from './pages/Build';
import LandingEnhancements from './components/LandingEnhancements';

export default function App() {
  return window.location.pathname === '/build' ? <Build /> : <LandingEnhancements><Home /></LandingEnhancements>;
}
