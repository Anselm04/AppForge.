import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { TopNav } from "./components/TopNav.js";
import { SiteFooter } from "./components/SiteFooter.js";
import { useLocale } from "./i18n/LocaleContext.js";
import { Home } from "./pages/Home.js";
import { About } from "./pages/About.js";
import { Dashboard } from "./pages/Dashboard.js";
import { Build } from "./pages/Build.js";
import { Pricing } from "./pages/Pricing.js";
import { Admin } from "./pages/Admin.js";
import { AIBuilder } from "./pages/AIBuilder.js";
import { GraphicsEditor } from "./pages/GraphicsEditor.js";
import { TemplateMarketplace } from "./pages/TemplateMarketplace.js";
import { CreativeStudio } from "./pages/CreativeStudio.js";
import { VideoStudio } from "./pages/VideoStudio.js";
import { MusicStudio } from "./pages/MusicStudio.js";
import { MarketingStudio } from "./pages/MarketingStudio.js";
import { ARStudio } from "./pages/ARStudio.js";
import { EducationStudio } from "./pages/EducationStudio.js";
import { Login } from "./pages/Login.js";
import { Signup } from "./pages/Signup.js";
import { Redeem } from "./pages/Redeem.js";

function AppShell() {
  const { locale, dir } = useLocale();
  const { pathname } = useLocation();
  const hideFooter = pathname.startsWith("/build");
  return (
    <div lang={locale} dir={dir} className="min-h-screen flex flex-col">
      <TopNav />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/redeem" element={<Redeem />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/build/:projectId" element={<Build />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/ai-builder" element={<AIBuilder />} />
          <Route path="/templates" element={<TemplateMarketplace />} />
          <Route path="/editor" element={<GraphicsEditor />} />
          <Route path="/studio" element={<CreativeStudio />} />
          <Route path="/studio/video" element={<VideoStudio />} />
          <Route path="/studio/music" element={<MusicStudio />} />
          <Route path="/studio/marketing" element={<MarketingStudio />} />
          <Route path="/studio/ar" element={<ARStudio />} />
          <Route path="/studio/education" element={<EducationStudio />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      {!hideFooter && <SiteFooter />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
