import Home from './pages/Home';
import Build from './pages/Build';

export default function App() {
  return window.location.pathname === '/build' ? <Build /> : <Home />;
}
