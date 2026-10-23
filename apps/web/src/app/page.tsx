export default function Page() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200 font-sans relative overflow-hidden">
      {/* Luces difusas de fondo */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-700/20 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="relative z-10">
        {/* Navegación Institucional (Translúcida) */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 bg-neutral-950/60 backdrop-blur-md border-b border-red-600/30">
          <h1 className="text-2xl font-bold text-red-500 tracking-wider">IINICIA</h1>
          <nav className="hidden md:flex gap-6 text-sm font-medium">
            <a href="#" className="hover:text-red-400 transition-colors">Universidad</a>
            <a href="#" className="hover:text-red-400 transition-colors">Oferta Académica</a>
            <a href="#" className="hover:text-red-400 transition-colors">Admisiones</a>
            <a href="#" className="hover:text-red-400 transition-colors">Noticias</a>
          </nav>
        </header>

        <main className="max-w-7xl mx-auto px-8 py-16 space-y-32">
          {/* Sección Hero y Login */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-5xl md:text-6xl font-extrabold leading-tight text-white">
                Plataforma Digital <br />
                <span className="text-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">Universitaria</span>
              </h2>
              <p className="text-neutral-400 text-lg leading-relaxed max-w-md">
                Bienvenido al portal institucional IINICIA. Un solo punto de acceso para tu oferta académica, perfil administrativo y el Campus Moodle.
              </p>
              <div className="flex gap-4 pt-4">
                <button className="px-6 py-3 bg-red-600/90 hover:bg-red-500 text-white font-semibold rounded-md backdrop-blur-sm transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                  Conoce más
                </button>
                <button className="px-6 py-3 border border-red-500/50 text-red-400 hover:bg-red-950/30 font-semibold rounded-md backdrop-blur-sm transition-colors">
                  Ver programas
                </button>
              </div>
            </div>

            {/* Tarjeta de Login (Efecto difuso sin relleno sólido) */}
            <div className="bg-neutral-900/30 backdrop-blur-xl p-8 rounded-2xl border border-neutral-800/50 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>
              <div className="text-center space-y-4 py-4">
                <h3 className="text-2xl font-bold text-white">Acceso al Portal</h3>
                <p className="text-sm text-neutral-400">
                  Ingresa tus credenciales para acceder a Mi IINICIA.
                </p>
                
                {/* Zona reservada para el login de Aaron */}
                <div 
                  id="zona-de-login" 
                  className="mt-8 p-10 border border-dashed border-red-500/30 bg-neutral-950/40 rounded-xl flex items-center justify-center min-h-[200px]"
                >
                  <p className="text-red-500/70 font-mono text-sm text-center">
                    [ Espacio reservado para componente Supabase Auth ]
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Sección de Indicadores / Oferta Académica */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { titulo: "Campus Virtual", desc: "Integración total con Moodle LMS" },
              { titulo: "Oferta Académica", desc: "Licenciaturas, diplomados y cursos" },
              { titulo: "Control de Roles", desc: "Perfiles seguros para docentes y alumnos" }
            ].map((item, i) => (
              <div key={i} className="bg-neutral-900/20 backdrop-blur-md border border-neutral-800/50 p-6 rounded-xl text-center hover:border-red-900/50 transition-colors">
                <h4 className="text-xl font-bold text-white mb-2">{item.titulo}</h4>
                <p className="text-sm text-neutral-500">{item.desc}</p>
              </div>
            ))}
          </section>
        </main>

        {/* Pie de página institucional */}
        <footer className="mt-20 border-t border-neutral-900 bg-neutral-950/80 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-red-700 font-bold text-xl tracking-widest">IINICIA</p>
            <p className="text-neutral-600 text-sm">
              © {new Date().getFullYear()} Plataforma Digital Institucional. Proyecto de Rediseño.
            </p>
            <div className="flex gap-4 text-sm text-neutral-500">
              <a href="#" className="hover:text-red-400">Contacto</a>
              <a href="#" className="hover:text-red-400">Privacidad</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}