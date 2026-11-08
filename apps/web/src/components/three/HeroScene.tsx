'use client';

export function HeroScene() {
  return (
    <div className="h-full w-full flex items-center justify-center relative">
      <div className="relative w-80 h-80">
        {/* Outer animated glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/40 to-purple-900/20 rounded-full blur-3xl animate-pulse" 
             style={{ animationDuration: '4s' }} />
        
        {/* Middle shimmer layer */}
        <div className="absolute inset-8 bg-gradient-to-tr from-indigo-500/30 to-purple-400/20 rounded-full blur-2xl" 
             style={{ 
               animation: 'shimmer 3s ease-in-out infinite',
             }} />
        
        {/* Core orb with gradient */}
        <div className="absolute inset-20 bg-gradient-to-br from-purple-400 via-purple-500 to-indigo-600 rounded-full shadow-2xl shadow-purple-500/70" />
        
        {/* Floating highlight */}
        <div className="absolute top-12 left-12 w-24 h-24 bg-white/50 rounded-full blur-2xl opacity-60" />
        
        <style>{`
          @keyframes shimmer {
            0% { opacity: 0.4; }
            50% { opacity: 0.8; }
            100% { opacity: 0.4; }
          }
          @keyframes float-gentle {
            0%, 100% { transform: translateY(0px) rotateZ(0deg); }
            50% { transform: translateY(-30px) rotateZ(180deg); }
          }
          .hero-scene-container {
            animation: float-gentle 8s ease-in-out infinite;
          }
        `}</style>
      </div>
    </div>
  );
}
