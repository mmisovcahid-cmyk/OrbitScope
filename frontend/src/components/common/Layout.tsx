import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Telescope,
  Crosshair,
  Orbit,
  BarChart2,
  BookOpen,
  Sun,
  Moon,
  Users,
  ChevronDown,
  Globe
} from 'lucide-react';
import { OrbitScopeLogo, NasaLogo, SpherexSatelliteIllustration } from './Icons';

export default function Layout() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [isDark, setIsDark] = useState(true);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === 'en' ? 'az' : 'en');
  };

  const navTabs = [
    { to: '/', label: 'Sky Explorer' },
    { to: '/detection', label: 'Object Tracking' },
    { to: '/planetx', label: 'Planet X Research' },
    { to: '/about', label: 'About' },
  ];

  const sidebarLinks = [
    { to: '/', icon: Telescope, label: 'Sky Explorer' },
    { to: '/detection', icon: Crosshair, label: 'Moving Objects' },
    { to: '/planetx', icon: Orbit, label: 'Planet X' },
    { to: '/catalog', icon: BarChart2, label: 'Data & Insights' },
    { to: '/about', icon: BookOpen, label: 'Methodology' },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-[#060a14] text-gray-200 overflow-hidden font-sans select-none">
      {/* ============================================================ */}
      {/* TOP HEADER */}
      {/* ============================================================ */}
      <header className="h-16 px-6 border-b border-white/[0.08] bg-[#070b18]/90 backdrop-blur-md flex items-center justify-between shrink-0 z-50">
        {/* Left: OrbitScope Branding & NASA meatball */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <OrbitScopeLogo className="w-9 h-9" />
            <div>
              <div className="text-lg font-bold text-white tracking-tight leading-none">
                OrbitScope
              </div>
              <div className="text-[11px] text-gray-400 mt-1 leading-none font-medium">
                SPHEREx Time-Domain Sky Monitor
              </div>
            </div>
          </div>

          <div className="h-8 w-[1px] bg-white/10 mx-1" />

          {/* NASA Meatball Badge */}
          <div className="flex items-center gap-2">
            <NasaLogo className="w-9 h-9" />
          </div>
        </div>

        {/* Center: Top Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-8">
          {navTabs.map((tab) => {
            const isActive = location.pathname === tab.to;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={`relative py-5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-sky-400'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 inset-x-0 h-[2.5px] bg-sky-400 rounded-t-full shadow-[0_0_12px_#38bdf8]" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Right: Controls & Space Apps pill */}
        <div className="flex items-center gap-4">
          {/* Theme toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            title="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Language toggle (AZ / EN) */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 transition-colors"
          >
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>{i18n.language === 'en' ? 'AZ' : 'EN'}</span>
          </button>

          {/* NASA Space Apps pill button */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/15 border border-sky-500/20 text-sky-400 text-xs font-medium cursor-pointer transition-colors">
            <Users className="w-3.5 h-3.5" />
            <span>NASA Space Apps</span>
            <ChevronDown className="w-3 h-3 text-sky-400/70" />
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* BODY (SIDEBAR + MAIN CONTENT) */}
      {/* ============================================================ */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ============================================================ */}
        {/* LEFT SIDEBAR */}
        {/* ============================================================ */}
        <aside className="w-56 border-r border-white/[0.08] bg-[#070b18]/70 backdrop-blur-md flex flex-col justify-between p-4 shrink-0 z-40 relative">
          {/* Top navigation buttons */}
          <div className="space-y-1.5">
            {sidebarLinks.map((link) => {
              const isActive = location.pathname === link.to;
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-600/30 to-sky-600/20 border border-sky-500/40 text-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.2)]'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/[0.03]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{link.label}</span>
                </NavLink>
              );
            })}
          </div>

          {/* Bottom Card: Powered by NASA SPHEREx */}
          <div className="space-y-3 pt-4">
            <div className="rounded-2xl bg-gradient-to-b from-[#0b1329] to-[#080d1e] border border-white/[0.09] p-3.5 relative overflow-hidden shadow-2xl">
              <div className="text-[10px] text-gray-400 font-medium">Powered by</div>
              <div className="text-xs font-bold text-white tracking-wide">NASA SPHEREx</div>

              {/* SPHEREx Telescope Illustration */}
              <div className="my-2 flex justify-center">
                <SpherexSatelliteIllustration className="w-24 h-20 drop-shadow-[0_0_15px_rgba(56,189,248,0.25)]" />
              </div>

              <div className="text-[10px] text-sky-300/80 leading-tight">
                All-sky survey in 102 infrared bands
              </div>
            </div>

            {/* Tagline */}
            <div className="text-[11px] italic font-serif text-gray-400 text-center tracking-wide">
              Explore. Analyze. Discover.
            </div>
          </div>

          {/* Atmospheric Earth Limb Glow (Bottom Left) */}
          <div
            className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full pointer-events-none opacity-40 blur-2xl"
            style={{
              background: 'radial-gradient(circle, #38bdf8 0%, #1e40af 60%, transparent 100%)',
            }}
          />
        </aside>

        {/* ============================================================ */}
        {/* MAIN OUTLET CONTAINER */}
        {/* ============================================================ */}
        <main className="flex-1 overflow-y-auto bg-[#060a14] relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
