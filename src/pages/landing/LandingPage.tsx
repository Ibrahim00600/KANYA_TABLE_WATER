interface SplashPageProps {
  onLogin: () => void;
}

export default function LandingPage({ onLogin }: SplashPageProps) {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden">
      {/* Product image as full background */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(/WhatsApp_Image_2026-07-27_at_1.04.57_PM.jpeg)` }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/55" />

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6">
        <div className="mb-8">
          <img
            src="/WhatsApp_Image_2026-07-27_at_1.04.57_PM.jpeg"
            alt="Kanya Table Water"
            className="w-40 h-40 object-contain rounded-2xl shadow-2xl border-4 border-white/30 mx-auto mb-6"
          />
          <h1 className="font-display font-bold text-5xl text-white mb-2 drop-shadow-lg">
            KANYA
          </h1>
          <p className="text-blue-200 text-xl font-medium tracking-widest uppercase">
            Table Water
          </p>
          <p className="text-white/70 text-sm mt-2 tracking-wide">
            NAFDAC REG NO: A1-104409L
          </p>
        </div>

        {/* Login button */}
        <button
          onClick={onLogin}
          className="mt-6 px-12 py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-display font-bold text-lg rounded-2xl shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300/50"
        >
          Sign In to Dashboard
        </button>

        <p className="mt-4 text-white/50 text-xs">Pure. Fresh. Reliable.</p>

        {/* Contact info */}
        <div className="mt-6 text-white/60 text-xs space-y-1">
          <p>Light Gold Phase 4, Abuja, FCT — Nigeria</p>
          <p>Kanyatablewater3@gmail.com</p>
          <p>+234 902 043 4132 &nbsp;|&nbsp; +234 814 448 3266</p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 inset-x-0 py-4 text-center">
        <p className="text-white/40 text-xs">
          &copy; {new Date().getFullYear()} Kanya Table Water Management System
        </p>
      </div>
    </div>
  );
}
